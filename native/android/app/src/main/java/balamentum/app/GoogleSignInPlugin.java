package balamentum.app;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CredentialOption;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * Native Google-Anmeldung über den Credential Manager (ADR 0023): Android zeigt das Konto-Sheet, kein
 * Browser. Das ID-Token geht an den Server (POST /auth/native/google), Zielgruppe ist der Web-Client.
 * Fehlercodes für die Web-App: canceled, no_credential, failed.
 */
@CapacitorPlugin(name = "GoogleSignIn")
public class GoogleSignInPlugin extends Plugin {

	@PluginMethod
	public void signIn(PluginCall call) {
		String serverClientId = call.getString("serverClientId");
		if (serverClientId == null || serverClientId.isEmpty()) {
			call.reject("serverClientId fehlt", "failed");
			return;
		}
		if (Boolean.TRUE.equals(call.getBoolean("auto", false))) {
			// Erst ein schon genutztes Konto ohne Rückfrage, sonst alle Konten im Sheet.
			request(call, googleIdOption(serverClientId, true), () -> request(call, googleIdOption(serverClientId, false), null));
		} else {
			request(call, new GetSignInWithGoogleOption.Builder(serverClientId).build(), null);
		}
	}

	/** Nach dem Abmelden wählt Android das Konto nicht mehr automatisch. */
	@PluginMethod
	public void signOut(PluginCall call) {
		CredentialManager.create(getContext()).clearCredentialStateAsync(
			new ClearCredentialStateRequest(),
			null,
			ContextCompat.getMainExecutor(getContext()),
			new CredentialManagerCallback<Void, ClearCredentialException>() {
				@Override
				public void onResult(Void result) {
					call.resolve();
				}

				@Override
				public void onError(@NonNull ClearCredentialException e) {
					call.reject(e.getMessage(), "failed");
				}
			}
		);
	}

	private static GetGoogleIdOption googleIdOption(String serverClientId, boolean authorizedOnly) {
		return new GetGoogleIdOption.Builder()
			.setServerClientId(serverClientId)
			.setFilterByAuthorizedAccounts(authorizedOnly)
			.setAutoSelectEnabled(authorizedOnly)
			.build();
	}

	/** Fragt ein Google-ID-Token an; `onNoCredential` greift, wenn kein passendes Konto da ist. */
	private void request(PluginCall call, CredentialOption option, Runnable onNoCredential) {
		GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
		CredentialManager.create(getContext()).getCredentialAsync(
			getActivity(),
			request,
			null,
			ContextCompat.getMainExecutor(getContext()),
			new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
				@Override
				public void onResult(GetCredentialResponse response) {
					try {
						GoogleIdTokenCredential credential = GoogleIdTokenCredential.createFrom(response.getCredential().getData());
						JSObject result = new JSObject();
						result.put("idToken", credential.getIdToken());
						call.resolve(result);
					} catch (Exception e) {
						call.reject(e.getMessage(), "failed");
					}
				}

				@Override
				public void onError(@NonNull GetCredentialException e) {
					if (e instanceof NoCredentialException && onNoCredential != null) {
						onNoCredential.run();
					} else if (e instanceof GetCredentialCancellationException) {
						call.reject(e.getMessage(), "canceled");
					} else if (e instanceof NoCredentialException) {
						call.reject(e.getMessage(), "no_credential");
					} else {
						call.reject(e.getMessage(), "failed");
					}
				}
			}
		);
	}
}

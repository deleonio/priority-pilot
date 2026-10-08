package balamentum.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

	@Override
	public void onCreate(Bundle savedInstanceState) {
		// Eigene Plugins vor super.onCreate registrieren, sonst kennt die Bridge sie nicht.
		registerPlugin(GoogleSignInPlugin.class);
		super.onCreate(savedInstanceState);
	}

	/**
	 * Der WebView hält Cookies zunächst im Speicher. Ohne Flush fehlt das Session-Cookie nach dem
	 * Wegwischen der App oder einem Geräte-Neustart (#1900).
	 */
	@Override
	public void onPause() {
		super.onPause();
		CookieManager.getInstance().flush();
	}
}

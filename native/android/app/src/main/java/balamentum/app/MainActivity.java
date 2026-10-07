package balamentum.app;

import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

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

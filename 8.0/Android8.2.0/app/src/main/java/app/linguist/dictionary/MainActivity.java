package app.linguist.dictionary;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + APP_HOST + "/index.html";
    private static final int REQUEST_FILE = 6101;
    private static final int REQUEST_SAVE = 6102;

    private static final String DOWNLOAD_HOOK =
        "(function(){" +
        "if(window.__linguistAndroidDownloadHook||!window.LinguistAndroid){return;}" +
        "window.__linguistAndroidDownloadHook=true;" +
        "var originalClick=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){" +
        "if(this.download&&/^blob:/i.test(this.href)){" +
        "var name=this.download,href=this.href;" +
        "fetch(href).then(function(response){return response.blob();})" +
        ".then(function(blob){return new Promise(function(resolve,reject){" +
        "var reader=new FileReader();" +
        "reader.onloadend=function(){resolve(reader.result);};" +
        "reader.onerror=function(){reject(reader.error);};" +
        "reader.readAsDataURL(blob);" +
        "});})" +
        ".then(function(dataUrl){window.LinguistAndroid.saveBase64(name,dataUrl);})" +
        ".catch(function(){window.LinguistAndroid.downloadFailed();});" +
        "return;" +
        "}" +
        "return originalClick.apply(this,arguments);" +
        "};" +
        "})();";

    private WebView webView;
    private ValueCallback<Uri[]> pendingFileCallback;
    private String pendingSaveData;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.TRANSPARENT);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        root.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);
        applySystemBarIcons();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setDefaultTextEncodingName("UTF-8");
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new DownloadBridge(), "LinguistAndroid");
        webView.setWebViewClient(new LocalWebViewClient());
        webView.setWebChromeClient(new AppChromeClient());
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                if (url != null && url.startsWith("http")) {
                    openExternal(Uri.parse(url));
                }
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void applySystemBarIcons() {
        int flags = 0;
        int nightMode = getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK;
        if (nightMode != Configuration.UI_MODE_NIGHT_YES) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    private boolean isTrustedPage() {
        if (webView == null || webView.getUrl() == null) return false;
        Uri current = Uri.parse(webView.getUrl());
        return "https".equals(current.getScheme()) && APP_HOST.equals(current.getHost());
    }

    private WebResourceResponse localIndexResponse() {
        try {
            InputStream stream = getAssets().open("linguist.html");
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, stream);
        } catch (IOException error) {
            return new WebResourceResponse(
                "text/plain",
                "UTF-8",
                new ByteArrayInputStream("Linguist asset is missing.".getBytes())
            );
        }
    }

    private WebResourceResponse missingLocalResponse() {
        return new WebResourceResponse(
            "text/plain",
            "UTF-8",
            404,
            "Not Found",
            new HashMap<String, String>(),
            new ByteArrayInputStream(new byte[0])
        );
    }

    private void injectDownloadHook() {
        if (isTrustedPage()) {
            webView.evaluateJavascript(DOWNLOAD_HOOK, null);
        }
    }

    private boolean openExternal(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            toast(getString(R.string.no_browser));
        }
        return true;
    }

    private void toast(int message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private final class LocalWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!APP_HOST.equals(uri.getHost())) return null;
            String path = uri.getPath();
            if (path == null || path.isEmpty() || "/".equals(path) || "/index.html".equals(path)) {
                return localIndexResponse();
            }
            return missingLocalResponse();
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (APP_HOST.equals(uri.getHost())) return false;
            return openExternal(uri);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri uri = Uri.parse(url);
            if (APP_HOST.equals(uri.getHost())) return false;
            return openExternal(uri);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (url != null && url.startsWith("https://" + APP_HOST + "/")) {
                injectDownloadHook();
            }
        }
    }

    private final class AppChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView target, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (pendingFileCallback != null) {
                pendingFileCallback.onReceiveValue(null);
            }
            pendingFileCallback = callback;

            Intent intent;
            try {
                intent = params.createIntent();
            } catch (RuntimeException error) {
                intent = null;
            }
            if (intent == null) {
                intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.setType("*/*");
            }
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }

            try {
                startActivityForResult(intent, REQUEST_FILE);
                return true;
            } catch (ActivityNotFoundException error) {
                pendingFileCallback = null;
                toast(R.string.no_file_picker);
                return false;
            }
        }
    }

    private final class DownloadBridge {
        @JavascriptInterface
        public void saveBase64(final String filename, final String dataUrl) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!isTrustedPage() || dataUrl == null
                        || !dataUrl.startsWith("data:") || dataUrl.indexOf(',') < 0) {
                        toast(R.string.save_failed);
                        return;
                    }

                    String safeName = filename == null ? "" : filename.trim();
                    safeName = safeName.replaceAll("[\\\\/\\p{Cntrl}]", "_");
                    if (safeName.isEmpty()) safeName = "linguist-backup.json";

                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(safeName.endsWith(".json")
                        ? "application/json" : "application/octet-stream");
                    intent.putExtra(Intent.EXTRA_TITLE, safeName);
                    pendingSaveData = dataUrl;
                    try {
                        startActivityForResult(intent, REQUEST_SAVE);
                    } catch (ActivityNotFoundException error) {
                        pendingSaveData = null;
                        toast(R.string.save_failed);
                    }
                }
            });
        }

        @JavascriptInterface
        public void downloadFailed() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    toast(R.string.save_failed);
                }
            });
        }
    }

    private void writeBackup(final Uri target, final String dataUrl) {
        Thread worker = new Thread(new Runnable() {
            @Override
            public void run() {
                boolean saved = false;
                try {
                    int comma = dataUrl.indexOf(',');
                    byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
                    OutputStream stream = getContentResolver().openOutputStream(target, "wt");
                    if (stream == null) throw new IOException("No output stream");
                    try {
                        stream.write(bytes);
                        stream.flush();
                        saved = true;
                    } finally {
                        stream.close();
                    }
                } catch (Exception error) {
                    saved = false;
                }

                final boolean result = saved;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        toast(result ? R.string.save_done : R.string.save_failed);
                    }
                });
            }
        }, "linguist-backup-writer");
        worker.start();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_FILE) {
            ValueCallback<Uri[]> callback = pendingFileCallback;
            pendingFileCallback = null;
            if (callback == null) return;

            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clipData = data.getClipData();
                if (clipData != null && clipData.getItemCount() > 0) {
                    results = new Uri[clipData.getItemCount()];
                    for (int index = 0; index < clipData.getItemCount(); index++) {
                        results[index] = clipData.getItemAt(index).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[] { data.getData() };
                }
            }
            callback.onReceiveValue(results);
            return;
        }

        if (requestCode == REQUEST_SAVE) {
            String dataUrl = pendingSaveData;
            pendingSaveData = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null
                && dataUrl != null) {
                writeBackup(data.getData(), dataUrl);
            }
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (pendingFileCallback != null) {
            pendingFileCallback.onReceiveValue(null);
            pendingFileCallback = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("LinguistAndroid");
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) parent.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}

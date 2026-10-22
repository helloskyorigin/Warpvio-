package com.warpvio.shell;

import android.app.Activity;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SafeBrowsingResponse;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Warpvio Android QA shell.
 *
 * The site is a REMOTE website, not privileged application code.
 * No Javascript interface, native bridge, file chooser or sensitive
 * Android permissions are exposed to its content.
 *
 * This QA shell supports same-origin navigation only. Social login,
 * external identity providers, download links, payment popups and
 * external browser navigation may not work. Device testing is required.
 */
public final class MainActivity extends Activity {
    private static final String HOME_URL = BuildConfig.SITE_URL;
    private FrameLayout root;
    private WebView browser;
    private LinearLayout overlay;
    private ProgressBar progress;
    private TextView heading;
    private TextView explanation;
    private Button retry;
    private boolean failed;

    private int dp(float size) {
        return Math.round(size * getResources().getDisplayMetrics().density);
    }

    private int accent() {
        try {
            return Color.parseColor(BuildConfig.ACCENT_COLOR);
        } catch (IllegalArgumentException ignored) {
            return Color.rgb(52, 120, 246);
        }
    }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        view.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        return view;
    }

    private void statusOverlay() {
        overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setGravity(Gravity.CENTER);
        overlay.setBackgroundColor(Color.rgb(247, 250, 255));
        overlay.setPadding(dp(26), dp(30), dp(26), dp(30));

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.warpvio_icon);
        icon.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(76), dp(76));
        iconParams.gravity = Gravity.CENTER_HORIZONTAL;
        iconParams.bottomMargin = dp(24);
        overlay.addView(icon, iconParams);

        heading = text(BuildConfig.APP_NAME, 24, Color.rgb(27, 35, 57), true);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        headingParams.bottomMargin = dp(12);
        overlay.addView(heading, headingParams);

        explanation = text("Connecting securely to your website…", 13, Color.rgb(110, 127, 157), false);
        explanation.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams explanationParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        explanationParams.bottomMargin = dp(22);
        overlay.addView(explanation, explanationParams);

        progress = new ProgressBar(this);
        progress.setIndeterminateTintList(ColorStateList.valueOf(accent()));
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(dp(30), dp(30));
        progressParams.gravity = Gravity.CENTER_HORIZONTAL;
        overlay.addView(progress, progressParams);

        retry = new Button(this);
        retry.setText("Try again");
        retry.setAllCaps(false);
        retry.setTextColor(Color.WHITE);
        retry.setBackgroundTintList(ColorStateList.valueOf(accent()));
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(v -> openSite());
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(dp(180), dp(48));
        retryParams.gravity = Gravity.CENTER_HORIZONTAL;
        overlay.addView(retry, retryParams);

        root.addView(overlay, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
    }

    private static boolean approved(Uri next) {
        if (next == null || next.getHost() == null ||
            !"https".equalsIgnoreCase(next.getScheme()) ||
            next.getUserInfo() != null ||
            (next.getPort() != -1 && next.getPort() != 443)) {
            return false;
        }
        Uri home = Uri.parse(HOME_URL);
        return home.getHost() != null && home.getHost().equalsIgnoreCase(next.getHost());
    }

    private void showError(String title, String detail) {
        failed = true;
        overlay.setVisibility(View.VISIBLE);
        heading.setText(title);
        explanation.setText(detail);
        progress.setVisibility(View.GONE);
        retry.setVisibility(View.VISIBLE);
    }

    private void showLoading() {
        failed = false;
        overlay.setVisibility(View.VISIBLE);
        heading.setText(BuildConfig.APP_NAME);
        explanation.setText("Connecting securely to your website…");
        progress.setVisibility(View.VISIBLE);
        retry.setVisibility(View.GONE);
    }

    private void createBrowser() {
        browser = new WebView(this);
        browser.setBackgroundColor(Color.WHITE);
        root.addView(browser, 0, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true); // Required for normal customer websites.
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setGeolocationEnabled(false);
        settings.setSafeBrowsingEnabled(true);

        // Debug APKs must not enable Chrome remote debugging of site contents.
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser, false);

        browser.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(request::deny);
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(
                String origin, android.webkit.GeolocationPermissions.Callback callback) {
                callback.invoke(origin, false, false);
            }

            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                filePathCallback.onReceiveValue(null);
                Toast.makeText(MainActivity.this,
                    "File uploads are not supported in this QA build", Toast.LENGTH_SHORT).show();
                return true;
            }
        });

        browser.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                if (approved(request.getUrl())) return false;
                Toast.makeText(MainActivity.this,
                    "External navigation is unavailable in this test app", Toast.LENGTH_SHORT).show();
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (approved(Uri.parse(url))) showLoading();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!failed && approved(Uri.parse(url))) overlay.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    showError("Couldn't open this website",
                        "Check your internet connection and try again. Your original website must remain online.");
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                            WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) {
                    showError("Website is unavailable",
                        "The website returned HTTP " + response.getStatusCode() + ". Please try again later.");
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); // NEVER allow insecure certificate bypass.
                showError("Connection security error",
                    "The website's HTTPS certificate could not be verified.");
            }

            @Override
            public void onSafeBrowsingHit(WebView view, WebResourceRequest request,
                                          int threatType, SafeBrowsingResponse callback) {
                callback.backToSafety(true);
                showError("Website blocked for safety",
                    "Android Safe Browsing detected a potentially harmful destination.");
            }

            @Override
            public boolean onRenderProcessGone(WebView view,
                android.webkit.RenderProcessGoneDetail detail) {
                root.removeView(view);
                view.destroy();
                browser = null;
                showError("Website renderer stopped",
                    "The website stopped responding. You can safely try again.");
                return true;
            }
        });

        browser.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            Toast.makeText(this, "Downloads are not supported in this QA build", Toast.LENGTH_SHORT).show());
    }

    private void openSite() {
        if (browser == null) createBrowser();
        showLoading();
        browser.loadUrl(HOME_URL);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(247, 250, 255));
        getWindow().setNavigationBarColor(Color.rgb(247, 250, 255));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        root = new FrameLayout(this);
        setContentView(root);
        statusOverlay();
        createBrowser();
        openSite();
    }

    @Override
    public void onBackPressed() {
        if (browser != null && browser.canGoBack()) {
            browser.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (browser != null) {
            root.removeView(browser);
            browser.destroy();
            browser = null;
        }
        super.onDestroy();
    }
}

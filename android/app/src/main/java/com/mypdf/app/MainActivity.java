package com.mypdf.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.exifinterface.media.ExifInterface;
import androidx.webkit.WebViewAssetLoader;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * MyPDF for Android: the whole toolkit runs on the phone (no computer, no internet).
 * The UI + PDF engine (MuPDF WebAssembly) + scanner (OpenCV.js) are bundled in assets/www and served at
 * https://appassets.androidplatform.net/. This activity adds what the web engine can't do by itself:
 * ML Kit text recognition, HEIC decoding, system fonts, saving to Downloads, sharing and opening files.
 */
public class MainActivity extends Activity {
    private static final int REQ_FILES = 11;
    private static final int REQ_CAMERA_PERM = 12;
    private static final int REQ_LIVE_CAMERA = 13;
    private static final int REQ_STORAGE = 14;
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/index.html";

    private WebView web;
    private ValueCallback<Uri[]> pendingFiles;
    private WebChromeClient.FileChooserParams pendingParams;
    private PermissionRequest pendingWebPermission;
    private Uri cameraUri;
    private File cameraFile;
    private File pendingSave;
    private final List<Uri> sharedIn = new ArrayList<>();
    private final ExecutorService io = Executors.newCachedThreadPool();
    private TextRecognizer recognizer;

    // ------------------------------------------------------------------ lifecycle
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " MyPDFAndroid/2.0");

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder().setDomain(HOST).addPathHandler("/", this::serveAsset).build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true; // other links (e.g. in a PDF) open in the browser
            }
        });
        web.setWebChromeClient(new Chrome());
        web.addJavascriptInterface(new Bridge(), "MyPDFAndroid");

        collectShared(getIntent());
        if (state != null) web.restoreState(state);
        if (web.getUrl() == null) web.loadUrl(HOME);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (collectShared(intent)) web.evaluateJavascript("window.receiveShared && window.receiveShared()", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (recognizer != null) recognizer.close();
        super.onDestroy();
    }

    private void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_SHORT).show());
    }

    // ------------------------------------------------------------------ bundled web app
    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("js", "text/javascript"); MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css"); MIME.put("wasm", "application/wasm"); MIME.put("json", "application/json");
        MIME.put("webmanifest", "application/manifest+json"); MIME.put("svg", "image/svg+xml"); MIME.put("png", "image/png");
        MIME.put("ico", "image/x-icon"); MIME.put("jpg", "image/jpeg"); MIME.put("pdf", "application/pdf");
        MIME.put("docx", "application/octet-stream"); MIME.put("md", "text/plain"); MIME.put("txt", "text/plain");
    }

    private WebResourceResponse serveAsset(String path) {
        if (path.isEmpty()) path = "index.html";
        int q = path.indexOf('?');
        if (q >= 0) path = path.substring(0, q);
        if (path.contains("..")) return null;
        try {
            InputStream in = getAssets().open("www/" + path);
            String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
            String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
            WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text/") ? "utf-8" : null, in);
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-cache");
            r.setResponseHeaders(h);
            return r;
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
        }
    }

    // ------------------------------------------------------------------ chrome: file picker, camera permission
    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
            if (pendingFiles != null) pendingFiles.onReceiveValue(null);
            pendingFiles = cb;
            pendingParams = params;
            if (params.isCaptureEnabled() && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA_PERM);
            } else {
                launchChooser();
            }
            return true;
        }

        @Override
        public boolean onConsoleMessage(android.webkit.ConsoleMessage m) {
            android.util.Log.i("MyPDF-JS", m.messageLevel() + " " + m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) { // live camera in the scanner
            runOnUiThread(() -> {
                if (!Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) { request.deny(); return; }
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                } else {
                    pendingWebPermission = request;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_LIVE_CAMERA);
                }
            });
        }
    }

    private boolean wantsImages(WebChromeClient.FileChooserParams p) {
        if (p.isCaptureEnabled()) return true;
        String[] types = p.getAcceptTypes();
        if (types == null || types.length == 0) return true;
        for (String t : types) {
            for (String part : t.split(",")) {
                String x = part.trim().toLowerCase(Locale.ROOT);
                if (x.isEmpty() || x.equals("*") || x.startsWith("image") || x.equals(".jpg") || x.equals(".jpeg") || x.equals(".png")) return true;
            }
        }
        return false;
    }

    private String[] mimeTypes(String[] accept) {
        Set<String> out = new LinkedHashSet<>();
        if (accept == null) return new String[0];
        for (String t : accept) {
            for (String part : t.split(",")) {
                String x = part.trim().toLowerCase(Locale.ROOT);
                if (x.isEmpty() || x.equals("*") || x.equals("*/*")) return new String[0];
                if (x.contains("/")) out.add(x);
                else if (x.startsWith(".")) {
                    String ext = x.substring(1);
                    String m = ext.equals("heic") || ext.equals("heif") ? "image/" + ext : ext.equals("md") || ext.equals("markdown") ? "text/markdown"
                            : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                    if (m != null) out.add(m);
                    if (ext.equals("md") || ext.equals("csv") || ext.equals("log") || ext.equals("json")) out.add("text/*");
                    if (ext.equals("epub")) out.add("application/epub+zip");
                }
            }
        }
        if (!out.isEmpty()) out.add("application/octet-stream"); // files some apps don't label
        return out.toArray(new String[0]);
    }

    private void launchChooser() {
        WebChromeClient.FileChooserParams p = pendingParams;
        Intent camera = null;
        cameraUri = null;
        cameraFile = null;
        if (p.isCaptureEnabled() && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            File dir = new File(getCacheDir(), "camera");
            dir.mkdirs();
            cameraFile = new File(dir, "photo_" + System.currentTimeMillis() + ".jpg");
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", cameraFile);
            camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                    .putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)
                    .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        try {
            if (p.isCaptureEnabled() && camera != null) {
                startActivityForResult(camera, REQ_FILES);
                return;
            }
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("*/*");
            String[] mimes = mimeTypes(p.getAcceptTypes());
            if (mimes.length > 0) pick.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
            // the app has its own "Take photo" button, so go straight to the file browser (Files, Drive, Photos…)
            startActivityForResult(pick, REQ_FILES);
        } catch (ActivityNotFoundException e) {
            pendingFiles.onReceiveValue(null);
            pendingFiles = null;
            toast("No app found to pick files");
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (code == REQ_CAMERA_PERM && pendingFiles != null) launchChooser();
        if (code == REQ_LIVE_CAMERA && pendingWebPermission != null) {
            if (ok) pendingWebPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else pendingWebPermission.deny();
            pendingWebPermission = null;
        }
        if (code == REQ_STORAGE && pendingSave != null) {
            File f = pendingSave;
            pendingSave = null;
            if (ok) saveToDownloads(f); else toast("Storage permission is needed to save to Downloads. Use Share instead.");
        }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code == REQ_FILES) {
            Uri[] picked = null;
            if (result == RESULT_OK) {
                if (data != null && data.getClipData() != null) {
                    ClipData clip = data.getClipData();
                    picked = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) picked[i] = clip.getItemAt(i).getUri();
                } else if (data != null && data.getData() != null) {
                    picked = new Uri[]{data.getData()};
                } else if (cameraFile != null && cameraFile.length() > 0) {
                    picked = new Uri[]{cameraUri};
                }
            }
            if (pendingFiles != null) pendingFiles.onReceiveValue(picked);
            pendingFiles = null;
            return;
        }
        super.onActivityResult(code, result, data);
    }

    // ------------------------------------------------------------------ files shared INTO the app
    private boolean collectShared(Intent intent) {
        if (intent == null) return false;
        String a = intent.getAction();
        List<Uri> got = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(a)) {
            Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) got.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(a)) {
            ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) got.addAll(list);
        } else if (Intent.ACTION_VIEW.equals(a) && intent.getData() != null) {
            got.add(intent.getData());
        }
        if (got.isEmpty()) return false;
        sharedIn.clear();
        sharedIn.addAll(got);
        intent.setAction(Intent.ACTION_MAIN); // don't re-import on rotation
        return true;
    }

    private String displayName(Uri u) {
        try (Cursor c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String n = c.getString(0);
                if (n != null) return n;
            }
        } catch (Exception ignored) {
        }
        String last = u.getLastPathSegment();
        return last != null ? last : "document";
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[65536];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toByteArray();
    }

    // ------------------------------------------------------------------ saving / sharing results
    private static String mimeFor(String name) {
        String ext = MimeTypeMap.getFileExtensionFromUrl(name.replace(" ", "_"));
        String m = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase(Locale.ROOT));
        if (m == null && name.toLowerCase(Locale.ROOT).endsWith(".md")) m = "text/markdown";
        return m != null ? m : "application/octet-stream";
    }

    private void saveToDownloads(File f) {
        String name = f.getName();
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mimeFor(name));
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MyPDF");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new IOException("could not create the file");
                try (OutputStream out = getContentResolver().openOutputStream(uri); InputStream in = new FileInputStream(f)) {
                    copy(in, out);
                }
            } else {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    pendingSave = f;
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
                    return;
                }
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "MyPDF");
                dir.mkdirs();
                File dst = new File(dir, name);
                for (int i = 2; dst.exists(); i++) {
                    int dot = name.lastIndexOf('.');
                    dst = new File(dir, dot > 0 ? name.substring(0, dot) + " (" + i + ")" + name.substring(dot) : name + " (" + i + ")");
                }
                try (InputStream in = new FileInputStream(f); OutputStream out = new FileOutputStream(dst)) {
                    copy(in, out);
                }
            }
            toast("Saved to Downloads/MyPDF/" + name);
        } catch (Exception e) {
            toast("Could not save: " + e.getMessage());
        }
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] buf = new byte[65536];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
    }

    private void shareFile(File f) {
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
        Intent send = new Intent(Intent.ACTION_SEND)
                .setType(mimeFor(f.getName()))
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(send, "Share " + f.getName()));
    }

    private void openFile(File f) {
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
        Intent view = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, mimeFor(f.getName()))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivity(Intent.createChooser(view, "Open with"));
        } catch (ActivityNotFoundException e) {
            toast("No app installed that can open this file");
        }
    }

    // ------------------------------------------------------------------ images, OCR, fonts
    private Bitmap decode(byte[] data, int maxSide) throws IOException {
        Bitmap bmp;
        if (Build.VERSION.SDK_INT >= 28) { // handles HEIC and EXIF rotation
            ImageDecoder.Source src = ImageDecoder.createSource(ByteBuffer.wrap(data));
            bmp = ImageDecoder.decodeBitmap(src, (dec, info, s) -> {
                dec.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                int w = info.getSize().getWidth(), h = info.getSize().getHeight();
                if (maxSide > 0 && Math.max(w, h) > maxSide) {
                    float k = (float) maxSide / Math.max(w, h);
                    dec.setTargetSize(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
                }
            });
        } else {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, o);
            int sample = 1;
            while (maxSide > 0 && Math.max(o.outWidth, o.outHeight) / sample > maxSide * 2) sample *= 2;
            o = new BitmapFactory.Options();
            o.inSampleSize = sample;
            bmp = BitmapFactory.decodeByteArray(data, 0, data.length, o);
            if (bmp == null) throw new IOException("unsupported image");
            int deg = new ExifInterface(new ByteArrayInputStream(data)).getRotationDegrees();
            if (deg != 0) {
                Matrix m = new Matrix();
                m.postRotate(deg);
                bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), m, true);
            }
        }
        return bmp;
    }

    private void answer(String id, boolean ok, String payload) {
        String js = "window.MyPDFLocal && MyPDFLocal._answer(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(payload == null ? "" : payload) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    private synchronized TextRecognizer recognizer() {
        if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        return recognizer;
    }

    private void runOcr(String id, String b64) {
        io.execute(() -> {
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                Bitmap bmp = decode(data, 4096);
                recognizer().process(InputImage.fromBitmap(bmp, 0))
                        .addOnSuccessListener(io, (Text text) -> {
                            try {
                                JSONArray out = new JSONArray();
                                for (Text.TextBlock b : text.getTextBlocks()) {
                                    for (Text.Line l : b.getLines()) {
                                        Rect r = l.getBoundingBox();
                                        if (r == null) continue;
                                        JSONObject o = new JSONObject();
                                        o.put("text", l.getText());
                                        o.put("box", new JSONArray(new int[]{r.left, r.top, r.right, r.bottom}));
                                        out.put(o);
                                    }
                                }
                                answer(id, true, out.toString());
                            } catch (Exception e) {
                                answer(id, false, e.getMessage());
                            }
                        })
                        .addOnFailureListener(io, e -> answer(id, false, "Text recognition failed: " + e.getMessage()));
            } catch (Throwable e) {
                answer(id, false, "Could not read the image: " + e.getMessage());
            }
        });
    }

    private void runConvertImage(String id, String b64) {
        io.execute(() -> {
            try {
                Bitmap bmp = decode(Base64.decode(b64, Base64.DEFAULT), 6000);
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                bmp.compress(bmp.hasAlpha() ? Bitmap.CompressFormat.PNG : Bitmap.CompressFormat.JPEG, 92, bos);
                answer(id, true, Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP));
            } catch (Throwable e) {
                answer(id, false, "This image format isn't supported on this phone.");
            }
        });
    }

    private static final Map<String, String[]> FONT_HINTS = new HashMap<>();
    static {
        FONT_HINTS.put("sans", new String[]{"Roboto-Regular", "RobotoStatic-Regular", "Roboto", "NotoSans-Regular", "DroidSans"});
        FONT_HINTS.put("sans-bold", new String[]{"Roboto-Bold", "RobotoStatic-Bold", "NotoSans-Bold", "DroidSans-Bold"});
        FONT_HINTS.put("serif", new String[]{"NotoSerif-Regular", "NotoSerif", "DroidSerif-Regular"});
        FONT_HINTS.put("serif-bold", new String[]{"NotoSerif-Bold", "DroidSerif-Bold"});
        FONT_HINTS.put("script", new String[]{"DancingScript-Regular", "DancingScript"});
        FONT_HINTS.put("script-bold", new String[]{"DancingScript-Bold", "DancingScript"});
        FONT_HINTS.put("hand", new String[]{"ComingSoon", "CarroisGothicSC"});
        FONT_HINTS.put("symbols", new String[]{"NotoSansSymbols-Regular", "NotoSansSymbols", "NotoSansSymbols2"});
        FONT_HINTS.put("cjk", new String[]{"NotoSansCJK-Regular", "NotoSansCJK", "DroidSansFallback"});
    }
    private String[] systemFonts;

    /** Finds a system font file for a script / style key, e.g. "devanagari", "sans-bold". */
    private File findFont(String key) {
        if (systemFonts == null) {
            String[] list = new File("/system/fonts").list();
            systemFonts = list == null ? new String[0] : list;
            Arrays.sort(systemFonts);
        }
        String[] hints = FONT_HINTS.get(key);
        if (hints == null) { // a script name, e.g. devanagari -> NotoSansDevanagari-Regular.otf
            String script = key.replace("-bold", "");
            String cap = script.substring(0, 1).toUpperCase(Locale.ROOT) + script.substring(1);
            hints = key.endsWith("-bold")
                    ? new String[]{"NotoSans" + cap + "-Bold", "NotoSans" + cap + "UI-Bold", "NotoSerif" + cap + "-Bold"}
                    : new String[]{"NotoSans" + cap + "-Regular", "NotoSans" + cap + "-VF", "NotoSans" + cap, "NotoSans" + cap + "UI-Regular", "NotoSerif" + cap};
        }
        for (String h : hints) {
            for (String f : systemFonts) {
                String lf = f.toLowerCase(Locale.ROOT);
                if (lf.startsWith(h.toLowerCase(Locale.ROOT)) && (lf.endsWith(".ttf") || lf.endsWith(".otf") || lf.endsWith(".ttc"))) return new File("/system/fonts", f);
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ JavaScript bridge
    private final Map<String, File> saving = new HashMap<>();
    private final Map<String, OutputStream> savingOut = new HashMap<>();

    private class Bridge {
        @JavascriptInterface
        public String version() { return "2.0"; }

        @JavascriptInterface
        public String font(String key) {
            try {
                File f = findFont(key);
                if (f == null) return "";
                try (InputStream in = new FileInputStream(f)) {
                    return Base64.encodeToString(readAll(in), Base64.NO_WRAP);
                }
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void ocr(String id, String b64) { runOcr(id, b64); }

        @JavascriptInterface
        public void convertImage(String id, String b64) { runConvertImage(id, b64); }

        /** Chunked transfer of a result file from the page: saveBegin -> saveChunk* -> saveEnd(action). */
        @JavascriptInterface
        public synchronized String saveBegin(String name) {
            try {
                String safe = name.replaceAll("[\\\\/:*?\"<>|]", "_");
                File dir = new File(getCacheDir(), "out/" + System.nanoTime());
                dir.mkdirs();
                File f = new File(dir, safe);
                String token = "t" + System.nanoTime();
                saving.put(token, f);
                savingOut.put(token, new FileOutputStream(f));
                return token;
            } catch (IOException e) {
                toast("Could not save: " + e.getMessage());
                return "";
            }
        }

        @JavascriptInterface
        public synchronized void saveChunk(String token, String b64) {
            try {
                OutputStream out = savingOut.get(token);
                if (out != null) out.write(Base64.decode(b64, Base64.DEFAULT));
            } catch (IOException e) {
                toast("Could not save: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public synchronized void saveEnd(String token, String action) {
            File f = saving.remove(token);
            OutputStream out = savingOut.remove(token);
            try { if (out != null) out.close(); } catch (IOException ignored) { }
            if (f == null) return;
            runOnUiThread(() -> {
                if ("share".equals(action)) shareFile(f);
                else if ("open".equals(action)) openFile(f);
                else io.execute(() -> saveToDownloads(f));
            });
        }

        @JavascriptInterface
        public int sharedCount() { return sharedIn.size(); }

        /** One shared file as JSON {name, type, data(base64)}; the list is cleared after the last one. */
        @JavascriptInterface
        public String sharedFile(int i) {
            try {
                Uri u = sharedIn.get(i);
                String type = getContentResolver().getType(u);
                byte[] data;
                try (InputStream in = getContentResolver().openInputStream(u)) { data = readAll(in); }
                JSONObject o = new JSONObject();
                o.put("name", displayName(u));
                o.put("type", type == null ? "" : type);
                o.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
                if (i == sharedIn.size() - 1) sharedIn.clear();
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }
    }
}

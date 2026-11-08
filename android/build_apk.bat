@echo off
REM Rebuilds the MyPDF Android app -> android\MyPDF.apk (offline: the whole toolkit runs on the phone).
REM Needs Node.js (for the web bundle), Android Studio (SDK) and JDK 17.
cd /d "%~dp0"
pushd ..\phone
if not exist node_modules\mupdf call npm install || (popd & pause & exit /b 1)
node build.mjs || (popd & pause & exit /b 1)
popd
if exist "C:\Program Files\Java\jdk-17" set "JAVA_HOME=C:\Program Files\Java\jdk-17"
if not defined JAVA_HOME if exist "C:\Program Files\Android\Android Studio\jbr" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if not exist local.properties echo sdk.dir=%LOCALAPPDATA:\=\\%\\Android\\Sdk> local.properties
set "GRADLE="
for /d %%A in ("%USERPROFILE%\.gradle\wrapper\dists\gradle-8.*-all") do for /d %%D in ("%%A\*") do for /d %%G in ("%%D\gradle-8.*") do if exist "%%G\bin\gradle.bat" set "GRADLE=%%G\bin\gradle.bat"
if not defined GRADLE (echo Gradle 8 not found - open this folder once in Android Studio to download it. & pause & exit /b 1)
call "%GRADLE%" assembleRelease --console=plain || (pause & exit /b 1)
copy /y app\build\outputs\apk\release\app-release.apk MyPDF.apk >nul
echo.
echo Built android\MyPDF.apk

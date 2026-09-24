@echo off
rem Serve the decks over http and open them in the browser.
rem
rem The lab code is ES modules, and browsers block module scripts
rem on file:// (CORS, opaque origin). Double-clicking matrices.html therefore
rem shows the slide with an empty space where the lab should be, and no visible
rem error. Serving over http is the fix.
rem
rem Double-click this file, or run it from a terminal. Close the window to stop.

cd /d "%~dp0"
echo Serving %CD%
echo   deck : http://localhost:8000/matrices.html
echo   labs : http://localhost:8000/lab-preview.html
echo.
echo Close this window to stop.
echo.

rem Give the server a moment to bind before the browser asks for the page.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:8000/matrices.html"

python -m http.server 8000

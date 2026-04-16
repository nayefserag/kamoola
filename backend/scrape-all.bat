@echo off
echo ============================================
echo   Kamoola - Full Manga Scrape (All Sources)
echo ============================================
echo.
echo Building project...
cd /d "%~dp0"
call npm run build
echo.
echo Starting server and triggering scrape...
echo Server will start, then scrape will be triggered after 15 seconds.
echo This will scrape ALL 9 sources (4 English + 5 Arabic).
echo.

start /b node dist\main.js

echo Waiting 15 seconds for server to connect to MongoDB...
timeout /t 15 /nobreak >nul

echo.
echo Triggering full scrape on ALL sources...
curl -X POST http://localhost:3001/api/scraper/trigger
echo.
echo.
echo Scrape triggered! The server is now scraping all sources in the background.
echo You can check progress at: http://localhost:3001/api/scraper/status
echo.
echo Press any key to check status...
pause >nul
curl http://localhost:3001/api/scraper/status
echo.
echo.
echo Press any key to check again, or close this window.
pause >nul
curl http://localhost:3001/api/scraper/status
echo.
pause

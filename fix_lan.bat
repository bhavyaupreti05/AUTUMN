@echo off
echo Fixing LAN Firewall...
netsh advfirewall firewall add rule name="ChatBot LAN" dir=in action=allow protocol=TCP localport=5173,8000
echo.
echo Done! Please close this window and refresh your other laptop.
pause

@echo off
:: Run this as Administrator (right-click -> Run as administrator)
:: Allows other computers on your network to reach this XAMPP site.

netsh advfirewall firewall add rule name="Apache HTTP (PHO DocuArchive)" dir=in action=allow protocol=TCP localport=80
if %errorlevel% equ 0 (
  echo Firewall rule added. Other users can try: http://YOUR_IP/PHO_DocuArchive
  echo Replace YOUR_IP with this PC IPv4 from ipconfig.
) else (
  echo Failed. Make sure you ran this as Administrator.
)
pause

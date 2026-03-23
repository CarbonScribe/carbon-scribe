@echo off
set "GOROOT=C:\Users\Muyideen.Jsx\Downloads\go1.26.1.windows-386\go"
set "PATH=%GOROOT%\bin;%PATH%"
echo ✅ Go environment is now set for this session!
echo.
go version
echo.
echo Now you can run: 
echo go mod tidy
echo go run cmd/api/main.go

$ErrorActionPreference="Stop"
if(-not (Get-Command em++ -ErrorAction SilentlyContinue)){throw "em++ not found. Install Emscripten and activate it first."}
if(-not (Get-Command git -ErrorAction SilentlyContinue)){throw "git not found."}
$root=Split-Path -Parent $PSScriptRoot;$third=Join-Path $root 'third_party_exhale';$vendor=Join-Path $root 'vendor\exhale';if(Test-Path $third){Remove-Item $third -Recurse -Force};New-Item -ItemType Directory -Force $vendor|Out-Null;git clone --depth 1 https://github.com/dtseto/exhale.git $third
$sources=Get-ChildItem "$third\src\lib","$third\src\app" -Filter *.cpp -File|Where-Object {$_.Name -notlike '*Pch.cpp'}|Sort-Object FullName|ForEach-Object {$_.FullName}
& em++ -O3 -flto -std=c++11 $sources -I"$third\include" -I"$third\src\lib" -I"$third\src\app" -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createExhale -sEXPORTED_FUNCTIONS='["_main"]' -sEXPORTED_RUNTIME_METHODS='["FS","callMain"]' -sFORCE_FILESYSTEM=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=134217728 -sSTACK_SIZE=8388608 -sNO_EXIT_RUNTIME=1 -sENVIRONMENT='web,worker,node' -sASSERTIONS=0 -o "$vendor\exhale.mjs"
Write-Host "Built xHE-AAC WebAssembly:";Get-ChildItem $vendor

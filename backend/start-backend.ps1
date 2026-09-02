Set-Location $PSScriptRoot

Write-Host "Starting Ano Tara backend on http://127.0.0.1:8000"
& py -3.12 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
Set-Location $PSScriptRoot

Write-Host "Starting Ano Tara backend on http://127.0.0.1:8000"
$python = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
	throw "Backend virtual environment not found at $python"
}
& $python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
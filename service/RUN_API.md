
## 1) Tạo venv

Tại thư mục `service/`:

```bash
python -m venv .venv
```

Kích hoạt (Windows PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
```

## 2) Cài thư viện

Tại `service/`:

```bash
python -m pip install -U pip
pip install -r requirements.txt
```

Tại thư mục `service/`:

```bash
python -m uvicorn api_server:app --host 0.0.0.0 --port 8000
```

### service
```bash
conda deactivate
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py --serve
```

### self-host judge0

```bash
git clone https://github.com/judge0/judge0
docker compose up -d db redis
docker compose up -d
sed -i 's/\r$//' judge0.conf
docker compose restart server worker
```
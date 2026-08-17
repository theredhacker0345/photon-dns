import glob
import os

files = glob.glob("**/*", recursive=True)
exclude_dirs = {"node_modules", ".git", ".manus-logs", "android/app/build", "android/.gradle", ".cache", "modules/pocket-hermes-supervisor/android/build"}

count = 0
for path in files:
    parts = path.split(os.sep)
    if any(ed in parts for ed in exclude_dirs) or "vendor" in parts or path.endswith(".png") or path.endswith(".apk"):
        continue
    if os.path.isdir(path):
        continue
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        continue
    
    new_content = content
    # Update user-facing title and repository URLs
    new_content = new_content.replace("Pocket Agent Host", "Pocket Agent Host")
    new_content = new_content.replace("https://gitlab.com/theredhacker0345/pocket-agent-host", "https://gitlab.com/theredhacker0345/pocket-agent-host")
    
    if new_content != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated display name in {path}")
        count += 1

print(f"Successfully updated display name in {count} files.")

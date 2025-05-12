
import json
import os

def append_to_merged_js(parsed_data, video_url, uploader_name, upload_date, lang, source_name, file_path="src/menuData_merged.js"):
    field_suffix = "EN" if lang == "en" else "KR"

    # Ensure the file exists
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("const menuData = [\n];\n\nexport default menuData;\n")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        existing_items = [json.loads(item) for item in content.split("{")[1:] if "url" in item]
        if any(video_url in item for item in content.split("")):
            print("⚠️ 이미 저장된 URL → 추가 생략")
            return

    entry = {
        "url": video_url,
        "uploader": uploader_name,
        "upload_date": upload_date,
        f"name{field_suffix}": parsed_data["메뉴"],
        f"ingredients{field_suffix}": parsed_data["재료"],
        "source": source_name
    }

    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()

    close_idx = next((i for i, line in reversed(list(enumerate(lines))) if line.strip().startswith("]")), -1)
    export_idx = next((i for i, line in reversed(list(enumerate(lines))) if "export default" in line), -1)

    if close_idx == -1 or export_idx == -1:
        print("❌ JS 형식 이상")
        return

    insert_idx = 1
    lines.insert(insert_idx, json.dumps(entry, ensure_ascii=False, indent=2) + ",")
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(line + "\n" for line in lines)

    print(f"✅ 데이터 추가 완료 (언어: {field_suffix}, 출처: {source_name})")

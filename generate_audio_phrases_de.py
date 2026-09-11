#!/usr/bin/env python3
"""
Generiert die fehlenden DEUTSCHEN Audiodateien fuer die Wendungen (PHRASES_VOCAB) per
Azure Speech. Wird fuer den Quiz-Modus gebraucht (dort wird der deutsche Satz vorgelesen).
Einmalig auf DEINEM Computer ausfuehren.

Vorbereitung:
  1. Terminal oeffnen, in diesen Ordner wechseln:
     cd "/Users/flamrolas/Desktop/bisaya github/bisaya-lernen"
  2. Azure Speech Key setzen (falls noch nicht gesetzt in dieser Terminal-Sitzung):
     export AZURE_SPEECH_KEY="dein-azure-key"
     export AZURE_SPEECH_REGION="eastus"
  3. Starten:
     python3 generate_audio_phrases_de.py

Ergebnis: neue MP3s im Ordner "audio/" + Datei "phrases_audio_map_de.json".
Danach einfach "fertig" sagen, Claude baut den Rest ein.
"""
import json, hashlib, os, sys, time

AZURE_KEY = os.environ.get("AZURE_SPEECH_KEY")
AZURE_REGION = os.environ.get("AZURE_SPEECH_REGION", "eastus")
VOICE = "de-DE-KatjaNeural"
TTS_URL = f"https://{AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"

AUDIO_DIR = "audio"
MANIFEST_FILE = "phrases_audio_map_de.json"
TEXTS_FILE = "phrases_missing_de.json"

try:
    import requests
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

from concurrent.futures import ThreadPoolExecutor, as_completed

def filename_for(text):
    h = hashlib.md5(text.encode("utf-8")).hexdigest()[:16]
    return f"{h}.mp3"

def ssml_for(text, voice, lang):
    esc = (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
               .replace('"', "&quot;").replace("'", "&apos;"))
    return f'<speak version="1.0" xml:lang="{lang}"><voice name="{voice}">{esc}</voice></speak>'

def synth_one(text):
    fname = filename_for(text)
    path = os.path.join(AUDIO_DIR, fname)
    if os.path.exists(path) and os.path.getsize(path) > 500:
        return (text, fname, "skip")
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-64kbitrate-mono-mp3",
        "User-Agent": "bisaya-lebendig-app",
    }
    body = ssml_for(text, VOICE, "de-DE").encode("utf-8")
    last_err = "unbekannt"
    for attempt in range(4):
        try:
            r = requests.post(TTS_URL, headers=headers, data=body, timeout=20)
            if r.status_code == 200 and len(r.content) > 200:
                with open(path, "wb") as f:
                    f.write(r.content)
                return (text, fname, "ok")
            elif r.status_code == 429:
                time.sleep(2 + attempt * 2)
                continue
            else:
                return (text, fname, f"error {r.status_code}: {r.text[:200]}")
        except Exception as e:
            last_err = str(e)
            time.sleep(1 + attempt)
    return (text, fname, f"error: {last_err}")

def main():
    if not AZURE_KEY:
        print("FEHLER: AZURE_SPEECH_KEY nicht gesetzt. export AZURE_SPEECH_KEY=\"dein-key\"")
        sys.exit(1)
    if not os.path.exists(TEXTS_FILE):
        print(f"FEHLER: {TEXTS_FILE} nicht gefunden.")
        sys.exit(1)
    os.makedirs(AUDIO_DIR, exist_ok=True)
    texts = json.load(open(TEXTS_FILE, encoding="utf-8"))
    manifest = {}
    if os.path.exists(MANIFEST_FILE):
        manifest = json.load(open(MANIFEST_FILE, encoding="utf-8"))
    print(f"Starte Generierung fuer {len(texts)} deutsche Wendungen (Stimme: {VOICE}) ...")
    ok, skip, err = 0, 0, 0
    errors = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(synth_one, t): t for t in texts}
        for i, fut in enumerate(as_completed(futures)):
            text, fname, status = fut.result()
            manifest[text] = fname
            if status == "ok": ok += 1
            elif status == "skip": skip += 1
            else:
                err += 1
                errors.append((text, status))
            if (i + 1) % 50 == 0 or (i + 1) == len(texts):
                json.dump(manifest, open(MANIFEST_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
                print(f"Fortschritt: {i+1}/{len(texts)} ok={ok} uebersprungen={skip} fehler={err}", flush=True)
    json.dump(manifest, open(MANIFEST_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nFERTIG. ok={ok} uebersprungen={skip} fehler={err} gesamt={len(texts)}")
    if errors:
        print("Erste Fehler:")
        for t, s in errors[:10]:
            print(" -", t[:40], "=>", s)

if __name__ == "__main__":
    main()

Scope
Build a small Android app that can:

Record voice note audio.
Transcribe it with Whisper on-device.
Store note metadata and transcript locally.
List saved notes.
No backend, no auth, no navigation, no analytics, no map, no Firebase.

Version Blueprint (Use These)

React Native: 0.69.7
React: 18.2.0
TypeScript: 4.8.x
whisper.rn: 0.4.3
react-native-fs: 2.18.0
react-native-audio-record: 0.2.2
Java JDK: 11
Android compileSdk: 33
Android targetSdk: 33
Android minSdk: 21
AGP: 7.1.1 if you want near-exact parity with this repo (or keep template defaults if compatible with RN 0.69.7)
Yarn classic 1.22.x
Tools You Need

Node (recommend Node 16 LTS for best RN 0.69 compatibility).
Yarn.
Android Studio.
Android SDK platform 33.
Android build-tools 31+.
Android command-line tools.
Android emulator or physical Android device.
NDK side-by-side installed (safe to include because Whisper native builds may rely on native toolchain in some environments).
Tools You Do Not Need For This Spike

Redux or redux-persist.
Navigation packages.
Firebase.
Mapbox.
MMKV or SQLite.
react-native-audio-recorder-player (unless you need playback UI right now).
Patch-package (unless you hit a real dependency issue).
Project Setup Plan

Create a new RN CLI TypeScript app pinned to RN 0.69.7.
Install only whisper.rn, react-native-fs, react-native-audio-record.
Confirm Android build works before writing feature logic.
Add Android permissions for internet and microphone.
Implement feature in isolated modules (no UI complexity first).
Wire simple one-screen UI after services work.
Android Manifest Requirements

INTERNET permission.
RECORD_AUDIO permission.
Important:

You can avoid external storage permissions if you save files only in app internal directories.
Keep storage internal for cleaner Android 11+ behavior.
Feature Architecture (No Code, Just Structure)
Create these responsibilities in your new app:

Recorder service.
Purpose: Start and stop WAV recording with 16 kHz mono PCM16 settings.
Whisper service.
Purpose: Ensure model directory exists, download model if missing, initialize context once, transcribe WAV path.
Notes repository.
Purpose: Save and load notes as local JSON metadata plus audio path.
Screen controller/state.
Purpose: Manage UI state machine and connect services.
Recommended Data Model
Each note record should contain:

id
createdAt
audioPath
transcript
language
durationMs (optional)
modelName (optional but useful for debugging)
Storage Layout
Use app document directory and create a dedicated feature root:

voice-notes/models
voice-notes/audio
voice-notes/notes
Recommended behavior:

Keep one Whisper model file cached.
Save each recording as a separate WAV file.
Save each note metadata as a JSON file, or maintain one index JSON file.
Recording Pipeline Blueprint

Request microphone permission at runtime before first recording.
Initialize recorder with 16kHz, mono, 16-bit, WAV output.
Start recording.
Stop recording and capture final local WAV path.
Validate file exists and file size is non-zero.
Pass path to transcription pipeline.
Whisper Pipeline Blueprint

On app launch or first use, ensure model directory exists.
If model file is missing, download it with progress updates.
Initialize Whisper context once and reuse it.
Transcribe the saved WAV path.
Capture transcription result and confidence info if available.
Release context on app shutdown/unmount if needed.
Model guidance:

Start with base quantized model to mirror your current approach.
If startup/download is too heavy, test tiny model for faster iteration first, then move to base.
UI State Machine Blueprint
Use explicit states so UX is predictable:

Idle
Preparing model
Downloading model
Ready
Recording
Transcribing
Saved
Error
Minimum actions:

Load model
Record
Stop and transcribe
Save note
Refresh notes list
Testing Checklist

App installs and launches on emulator/device.
Microphone permission prompt appears and handles deny/grant.
Recording generates a valid WAV file.
Whisper model downloads once and is reused.
Transcription runs and returns text.
Note metadata persists across app restarts.
Saved notes list repopulates on fresh launch.
Offline behavior after first model download still works.
Repeated record/transcribe cycles do not crash or leak memory.
Performance and Reliability Checklist

Do not reinitialize Whisper context for every transcription.
Handle interrupted downloads by deleting partial model files.
Block duplicate transcription calls while one is active.
Add timeout and error states for model download and transcribe.
Use internal storage only for predictable file access.
Add basic logging around each stage for debugging.
Common Pitfalls To Avoid

Using external storage permissions unnecessarily.
Starting transcription before recorder fully stops.
Recreating Whisper context every time.
Not handling partial model file on failed download.
Trying to use audio format/settings Whisper does not like.
Ignoring device microphone/emulator audio routing issues.
Exact Minimal Dependency Set Summary
Use only:

react-native
react
typescript
whisper.rn
react-native-fs
react-native-audio-record
Everything else can be added later only if a real requirement appears.
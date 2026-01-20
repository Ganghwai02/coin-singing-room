import mido

def parse_midi(file_path):
    mid = mido.MidiFile(file_path)
    notes = []
    for track in mid.tracks:
        time_accumulated = 0
        for msg in track:
            time_accumulated += msg.time
            if msg.type == 'note_on' and msg.velocity > 0:
                notes.append({
                    "time": time_accumulated,
                    "note": msg.note,      # 음높이 (예: ê@d 부분의 데이터) [cite: 1]
                    "velocity": msg.velocity
                })
    return notes
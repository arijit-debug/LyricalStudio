import type { LyricLine, Track } from "@/lib/types";

/**
 * Who a line belongs to, for Graph's vines. Lyrics sources never say who sings which line,
 * so for duets this follows how duets are usually built, not real detection:
 *
 * - "a" / "b": the two singers. Verses alternate between them, one section each.
 * - "both": choruses (sections made of lines that repeat), usually sung together; the two
 *   vines merge into one there.
 * - "echo": a line entirely in parentheses, i.e. backing or response vocals; it is drawn
 *   small (in a duet, in the lane across from the line it answers).
 * - "solo": any line of a song that isn't a duet.
 */
export type Voice = "a" | "b" | "both" | "echo" | "solo";

/**
 * A pause between one line's last word and the next line starts a new section when it is
 * at least this long (s), and SECTION_GAP_FACTOR times the song's usual pause between lines
 * (slow songs pause longer inside a verse too).
 */
const SECTION_GAP = 4;
const SECTION_GAP_FACTOR = 4;

/** A section is a chorus when at least this share of its lines are chorus lines. */
const CHORUS_SHARE = 0.6;

/**
 * Chorus lines come in runs of at least this many repeated lines in a row. Shorter runs
 * are hooks or pre-choruses that come back in each verse, sung by that verse's singer.
 */
const CHORUS_MIN_LINES = 3;

/**
 * Whether the credits name more than one singer: "A, B", "A & B", "A x B", "A feat. B",
 * "A with B". The artist field is checked, and the title for "(feat. B)" or a singers
 * segment such as "Song | Film | A, B". Bands with "&" or a comma in their name count as
 * duets too; the result is only a drawing style, so that's harmless.
 */
export function isDuetTrack(track: Pick<Track, "title" | "artist">): boolean {
  const many = /,|&|\s(?:x|×|and|with|vs\.?)\s|\b(?:feat|ft)\.?\s/i;
  if (many.test(track.artist)) return true;
  if (/[([]\s*(?:feat|ft|with)\.?\s/i.test(track.title) || /\s(?:feat|ft)\.\s/i.test(track.title)) return true;
  return track.title
    .split("|")
    .slice(1)
    .some((part) => /,|&/.test(part));
}

const isEcho = (line: LyricLine) => line.words.length > 0 && line.words.every((w) => w.backing);

/**
 * Voices for every line, or null when Graph should draw as it always has (not a duet and
 * no echo lines).
 */
export function assignVoices(lines: LyricLine[], duet: boolean): Voice[] | null {
  const echo = lines.map(isEcho);
  if (!duet) return echo.some(Boolean) ? echo.map((e) => (e ? "echo" : "solo")) : null;

  const main = lines.map((_, i) => i).filter((i) => !echo[i]);
  const pauseAfter = (i: number, next: number) => lines[next].start - (lines[i].words.at(-1)?.end ?? lines[i].end);
  const pauses = main.slice(0, -1).map((i, n) => pauseAfter(i, main[n + 1])).sort((x, y) => x - y);
  const sectionGap = Math.max(SECTION_GAP, (pauses[pauses.length >> 1] ?? 0) * SECTION_GAP_FACTOR);

  // chorus lines: runs of repeated lines (see CHORUS_MIN_LINES)
  const chorusLine: boolean[] = lines.map(() => false);
  for (let n = 0; n < main.length; ) {
    let end = n;
    while (end < main.length && lines[main[end]].repeats >= 2) end++;
    if (end - n >= CHORUS_MIN_LINES) for (let m = n; m < end; m++) chorusLine[main[m]] = true;
    n = Math.max(end, n + 1);
  }

  // sections: split at long pauses, and wherever lines switch between chorus and verse
  const sections: number[][] = [];
  let cur: number[] = [];
  for (const i of main) {
    const prev = cur.at(-1);
    if (prev !== undefined) {
      if (pauseAfter(prev, i) > sectionGap || chorusLine[i] !== chorusLine[prev]) {
        sections.push(cur);
        cur = [];
      }
    }
    cur.push(i);
  }
  if (cur.length) sections.push(cur);

  const voices: Voice[] = lines.map(() => "a");
  let next: "a" | "b" = "a";
  for (const s of sections) {
    const isChorus = s.filter((i) => chorusLine[i]).length >= s.length * CHORUS_SHARE;
    const v: Voice = isChorus ? "both" : next;
    if (!isChorus) next = next === "a" ? "b" : "a";
    for (const i of s) voices[i] = v;
  }
  echo.forEach((e, i) => {
    if (e) voices[i] = "echo";
  });
  return voices;
}

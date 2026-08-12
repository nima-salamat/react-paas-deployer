import React, { useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import {
  Stack, TextField, IconButton, Box, Chip, Tooltip, Typography,
  Popover, alpha, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import DoneIcon from "@mui/icons-material/Done";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ReplyIcon from "@mui/icons-material/Reply";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import MicIcon from "@mui/icons-material/Mic";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import VideocamIcon from "@mui/icons-material/Videocam";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";

const EMOJI_CATEGORIES = {
  Smileys: ["😀", "😂", "😍", "😎", "🤩", "🥳", "😭", "😡", "🤔", "😴", "🤯", "🥺", "😇", "🤗", "🙄", "😏"],
  Gestures: ["👍", "👎", "👏", "🙏", "💪", "✌️", "🤞", "🤟", "👌", "🙌", "👋", "✋", "🤙", "👊"],
  Hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️", "💕", "💞", "💖", "💘"],
  Objects: ["🔥", "⭐", "✨", "🎉", "🏆", "💎", "🚀", "💡", "🎵", "🎁", "☕", "🍕", "🍺", "📚"],
  Symbols: ["✅", "❌", "❓", "❗", "⚠️", "💯", "🔱", "🔰", "♻️", "🌐", "💤", "💥"],
};

/** Shortcode search — EN + FA keywords. Only replaces when user picks (Enter/click). */
const EMOJI_DICT = [
  { e: "😀", k: ["grinning", "smile", "happy", "خوشحال", "خندان", "لبخند"] },
  { e: "😃", k: ["smiley", "happy", "خوشحال"] },
  { e: "😄", k: ["smile", "happy", "grin", "خنده"] },
  { e: "😁", k: ["grin", "beaming", "خنده"] },
  { e: "😆", k: ["laughing", "satisfied", "خنده"] },
  { e: "😅", k: ["sweat_smile", "nervous", "خنده"] },
  { e: "🤣", k: ["rofl", "rolling", "خنده", "قهقهه"] },
  { e: "😂", k: ["joy", "laugh", "lol", "lmao", "خنده", "قهقهه", "گریه خنده"] },
  { e: "🙂", k: ["slight_smile", "smile", "لبخند"] },
  { e: "😉", k: ["wink", "چشمک"] },
  { e: "😊", k: ["blush", "happy", "خوشحال"] },
  { e: "😇", k: ["innocent", "angel", "فرشته"] },
  { e: "🥰", k: ["love", "smiling_hearts", "عاشق", "عشق"] },
  { e: "😍", k: ["heart_eyes", "love", "عاشق", "عشق"] },
  { e: "🤩", k: ["star_struck", "wow", "ستاره‌ای"] },
  { e: "😘", k: ["kiss", "بوسه", "ماچ"] },
  { e: "😗", k: ["kissing", "بوسه"] },
  { e: "😚", k: ["kissing_closed_eyes", "بوسه"] },
  { e: "😙", k: ["kissing_smiling_eyes", "بوسه"] },
  { e: "🥲", k: ["smiling_tear", "اشک"] },
  { e: "😋", k: ["yum", "delicious", "خوشمزه"] },
  { e: "😛", k: ["tongue", "زبون"] },
  { e: "😜", k: ["stuck_out_tongue_wink", "زبان"] },
  { e: "🤪", k: ["zany", "دیوونه"] },
  { e: "😝", k: ["stuck_out_tongue_closed", "زبان"] },
  { e: "🤑", k: ["money_mouth", "پول"] },
  { e: "🤗", k: ["hug", "بغل"] },
  { e: "🤭", k: ["hand_over_mouth", "خجالت"] },
  { e: "🤫", k: ["shush", "سکوت", "هیس"] },
  { e: "🤔", k: ["thinking", "فکر", "فکر کردن"] },
  { e: "🤐", k: ["zipper_mouth", "سکوت"] },
  { e: "🤨", k: ["raised_eyebrow", "مشکوک"] },
  { e: "😐", k: ["neutral", "خنثی"] },
  { e: "😑", k: ["expressionless", "بی‌حس"] },
  { e: "😶", k: ["no_mouth", "بی‌صدا"] },
  { e: "😏", k: ["smirk", "پوزخند"] },
  { e: "😒", k: ["unamused", "ناراضی"] },
  { e: "🙄", k: ["eye_roll", "چشم غره"] },
  { e: "😬", k: ["grimace", "لج"] },
  { e: "😮‍💨", k: ["exhale", "آه"] },
  { e: "🤥", k: ["lying", "دروغ"] },
  { e: "😌", k: ["relieved", "آروم"] },
  { e: "😔", k: ["pensive", "غمگین", "ناراحت"] },
  { e: "😪", k: ["sleepy", "خوابالو"] },
  { e: "🤤", k: ["drooling", "آب دهن"] },
  { e: "😴", k: ["sleeping", "خواب", "خوابیدن"] },
  { e: "😷", k: ["mask", "ماسک", "مریض"] },
  { e: "🤒", k: ["thermometer", "تب", "مریض"] },
  { e: "🤕", k: ["head_bandage", "زخم"] },
  { e: "🤢", k: ["nauseated", "تهوع"] },
  { e: "🤮", k: ["vomit", "استفراغ"] },
  { e: "🥵", k: ["hot", "داغ"] },
  { e: "🥶", k: ["cold", "سرد"] },
  { e: "🥴", k: ["woozy", "گیج"] },
  { e: "😵", k: ["dizzy", "گیج"] },
  { e: "🤯", k: ["exploding_head", "منفجر", "شوک"] },
  { e: "🤠", k: ["cowboy", "کابوی"] },
  { e: "🥳", k: ["party", "جشن", "تولد"] },
  { e: "😎", k: ["sunglasses", "cool", "خفن", "باحال"] },
  { e: "🤓", k: ["nerd", "خرخون"] },
  { e: "🧐", k: ["monocle", "جاسوس"] },
  { e: "😕", k: ["confused", "گیج"] },
  { e: "😟", k: ["worried", "نگران"] },
  { e: "🙁", k: ["slight_frown", "ناراحت"] },
  { e: "☹️", k: ["frown", "ناراحت"] },
  { e: "😮", k: ["open_mouth", "تعجب"] },
  { e: "😯", k: ["hushed", "تعجب"] },
  { e: "😲", k: ["astonished", "شوکه"] },
  { e: "😳", k: ["flushed", "خجالت"] },
  { e: "🥺", k: ["pleading", "التماس", "نگاه"] },
  { e: "😦", k: ["frowning", "ناراحت"] },
  { e: "😧", k: ["anguished", "رنج"] },
  { e: "😨", k: ["fearful", "ترس"] },
  { e: "😰", k: ["anxious", "اضطراب"] },
  { e: "😥", k: ["sad_relieved", "ناراحت"] },
  { e: "😢", k: ["cry", "گریه", "اشک"] },
  { e: "😭", k: ["sob", "گریه", "های های"] },
  { e: "😱", k: ["scream", "جیغ", "ترس"] },
  { e: "😖", k: ["confounded", "گیج"] },
  { e: "😣", k: ["persevering", "سخت"] },
  { e: "😞", k: ["disappointed", "ناامید"] },
  { e: "😓", k: ["downcast", "خسته"] },
  { e: "😩", k: ["weary", "خسته"] },
  { e: "😫", k: ["tired", "خسته"] },
  { e: "🥱", k: ["yawn", "خمیازه"] },
  { e: "😤", k: ["triumph", "عصبانی"] },
  { e: "😡", k: ["rage", "angry", "عصبانی", "خشم"] },
  { e: "😠", k: ["angry", "عصبانی"] },
  { e: "🤬", k: ["cursing", "فحش"] },
  { e: "😈", k: ["smiling_imp", "شیطون"] },
  { e: "👿", k: ["imp", "شیطان"] },
  { e: "💀", k: ["skull", "جمجمه", "مرگ"] },
  { e: "☠️", k: ["skull_crossbones", "مرگ"] },
  { e: "💩", k: ["poop", "shit", "گوه"] },
  { e: "🤡", k: ["clown", "دلقک"] },
  { e: "👹", k: ["ogre", "غول"] },
  { e: "👺", k: ["goblin"] },
  { e: "👻", k: ["ghost", "روح", "شبح"] },
  { e: "👽", k: ["alien", "فضایی"] },
  { e: "👾", k: ["space_invader", "بازی"] },
  { e: "🤖", k: ["robot", "ربات"] },
  { e: "😺", k: ["smiley_cat", "گربه"] },
  { e: "😸", k: ["smile_cat", "گربه"] },
  { e: "😹", k: ["joy_cat", "گربه"] },
  { e: "😻", k: ["heart_eyes_cat", "گربه"] },
  { e: "😼", k: ["smirk_cat", "گربه"] },
  { e: "😽", k: ["kissing_cat", "گربه"] },
  { e: "🙀", k: ["scream_cat", "گربه"] },
  { e: "😿", k: ["crying_cat", "گربه"] },
  { e: "😾", k: ["pouting_cat", "گربه"] },
  { e: "👍", k: ["thumbsup", "+1", "like", "آفرین", "لایک", "خوب"] },
  { e: "👎", k: ["thumbsdown", "-1", "بد", "دیسلایک"] },
  { e: "👏", k: ["clap", "applause", "تشویق", "دست زدن"] },
  { e: "🙌", k: ["raised_hands", "هلهله"] },
  { e: "👋", k: ["wave", "hello", "سلام", "خداحافظ"] },
  { e: "🤝", k: ["handshake", "دست دادن", "توافق"] },
  { e: "🙏", k: ["pray", "please", "thanks", "لطفا", "ممنون", "دعا"] },
  { e: "💪", k: ["muscle", "strong", "قوی", "بازو"] },
  { e: "✌️", k: ["v", "peace", "صلح"] },
  { e: "🤞", k: ["fingers_crossed", "شانس"] },
  { e: "🤟", k: ["love_you_gesture", "عاشقتم"] },
  { e: "🤘", k: ["metal", "rock"] },
  { e: "👌", k: ["ok_hand", "باشه", "اوکی"] },
  { e: "🤌", k: ["pinched_fingers", "ایتالیایی"] },
  { e: "🤏", k: ["pinching_hand", "کم"] },
  { e: "👈", k: ["point_left", "چپ"] },
  { e: "👉", k: ["point_right", "راست"] },
  { e: "👆", k: ["point_up", "بالا"] },
  { e: "👇", k: ["point_down", "پایین"] },
  { e: "✋", k: ["hand", "stop", "دست", "ایست"] },
  { e: "🤚", k: ["raised_back_of_hand"] },
  { e: "🖐️", k: ["raised_hand_fingers"] },
  { e: "🖖", k: ["vulcan"] },
  { e: "❤️", k: ["heart", "love", "red_heart", "عشق", "قلب", "قرمز"] },
  { e: "🧡", k: ["orange_heart", "قلب"] },
  { e: "💛", k: ["yellow_heart", "قلب"] },
  { e: "💚", k: ["green_heart", "قلب"] },
  { e: "💙", k: ["blue_heart", "قلب"] },
  { e: "💜", k: ["purple_heart", "قلب"] },
  { e: "🖤", k: ["black_heart", "قلب"] },
  { e: "🤍", k: ["white_heart", "قلب"] },
  { e: "🤎", k: ["brown_heart", "قلب"] },
  { e: "💔", k: ["broken_heart", "شکسته", "قلب شکسته"] },
  { e: "❣️", k: ["heart_exclamation", "قلب"] },
  { e: "💕", k: ["two_hearts", "عشق"] },
  { e: "💞", k: ["revolving_hearts", "عشق"] },
  { e: "💓", k: ["heartbeat", "ضربان"] },
  { e: "💗", k: ["growing_heart", "عشق"] },
  { e: "💖", k: ["sparkling_heart", "عشق"] },
  { e: "💘", k: ["cupid", "تیر عشق"] },
  { e: "💝", k: ["gift_heart", "هدیه"] },
  { e: "🔥", k: ["fire", "lit", "آتش", "داغ", "خفن"] },
  { e: "⭐", k: ["star", "ستاره"] },
  { e: "🌟", k: ["glowing_star", "ستاره"] },
  { e: "✨", k: ["sparkles", "درخشش"] },
  { e: "⚡", k: ["zap", "lightning", "برق", "رعد"] },
  { e: "🎉", k: ["tada", "party", "جشن", "تبریک"] },
  { e: "🎊", k: ["confetti", "جشن"] },
  { e: "🎈", k: ["balloon", "بادکنک"] },
  { e: "🏆", k: ["trophy", "جام", "قهرمان"] },
  { e: "🥇", k: ["first_place", "طلا"] },
  { e: "🥈", k: ["second_place", "نقره"] },
  { e: "🥉", k: ["third_place", "برنز"] },
  { e: "💎", k: ["gem", "الماس"] },
  { e: "🚀", k: ["rocket", "موشک"] },
  { e: "💡", k: ["bulb", "idea", "ایده", "لامپ"] },
  { e: "🎵", k: ["musical_note", "آهنگ", "موسیقی"] },
  { e: "🎶", k: ["notes", "موسیقی"] },
  { e: "🎁", k: ["gift", "هدیه"] },
  { e: "☕", k: ["coffee", "قهوه"] },
  { e: "🍕", k: ["pizza", "پیتزا"] },
  { e: "🍔", k: ["burger", "همبرگر"] },
  { e: "🍺", k: ["beer", "آبجو"] },
  { e: "🍷", k: ["wine", "شراب"] },
  { e: "📚", k: ["books", "کتاب"] },
  { e: "✅", k: ["white_check_mark", "check", "تیک", "درست", "اوکی"] },
  { e: "❌", k: ["x", "cross", "غلط", "نادرست"] },
  { e: "❓", k: ["question", "سوال"] },
  { e: "❗", k: ["exclamation", "تعجب"] },
  { e: "⚠️", k: ["warning", "هشدار"] },
  { e: "💯", k: ["100", "hundred", "صد"] },
  { e: "💤", k: ["zzz", "خواب"] },
  { e: "💥", k: ["boom", "انفجار"] },
  { e: "👀", k: ["eyes", "چشم", "نگاه"] },
  { e: "🧠", k: ["brain", "مغز"] },
  { e: "🎂", k: ["birthday", "تولد", "کیک"] },
  { e: "🌹", k: ["rose", "گل", "رز"] },
  { e: "🌸", k: ["cherry_blossom", "شکوفه"] },
  { e: "☀️", k: ["sun", "آفتاب", "خورشید"] },
  { e: "🌙", k: ["moon", "ماه"] },
  { e: "🌈", k: ["rainbow", "رنگین کمان"] },
  { e: "☔", k: ["umbrella", "باران", "چتر"] },
  { e: "🐶", k: ["dog", "سگ"] },
  { e: "🐱", k: ["cat", "گربه"] },
  { e: "🐻", k: ["bear", "خرس"] },
  { e: "🐼", k: ["panda", "پاندا"] },
  { e: "🦊", k: ["fox", "روباه"] },
  { e: "🦁", k: ["lion", "شیر"] },
  { e: "🐸", k: ["frog", "قورباغه"] },
  { e: "🐵", k: ["monkey", "میمون"] },
  { e: "🦄", k: ["unicorn", "یونیکورن"] },
  { e: "🐝", k: ["bee", "زنبور"] },
  { e: "🐛", k: ["bug", "حشره"] },
  { e: "🦋", k: ["butterfly", "پروانه"] },
  { e: "🐢", k: ["turtle", "لاکپشت"] },
  { e: "🐙", k: ["octopus", "اختاپوس"] },
  { e: "🐬", k: ["dolphin", "دلفین"] },
  { e: "🐳", k: ["whale", "نهنگ"] },
  { e: "🌍", k: ["earth", "جهان", "زمین"] },
  { e: "✈️", k: ["airplane", "هواپیما"] },
  { e: "🚗", k: ["car", "ماشین"] },
  { e: "🏠", k: ["house", "خانه"] },
  { e: "📱", k: ["iphone", "phone", "موبایل", "تلفن"] },
  { e: "💻", k: ["laptop", "computer", "لپتاپ", "کامپیوتر"] },
  { e: "⌚", k: ["watch", "ساعت"] },
  { e: "📷", k: ["camera", "دوربین"] },
  { e: "🎥", k: ["movie_camera", "فیلم"] },
  { e: "🎮", k: ["video_game", "بازی"] },
  { e: "🪙", k: ["coin", "سکه"] },
  { e: "💰", k: ["moneybag", "پول"] },
  { e: "💵", k: ["dollar", "دلار"] },
];

function normalizeQuery(q) {
  return String(q || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function matchEmojis(query, limit = 24) {
  const q = normalizeQuery(query);
  if (!q || q.length < 1) return [];
  const scored = [];
  for (const item of EMOJI_DICT) {
    let best = 0;
    for (const key of item.k) {
      const k = key.toLowerCase();
      if (k === q) best = Math.max(best, 100);
      else if (k.startsWith(q)) best = Math.max(best, 80 - (k.length - q.length));
      else if (k.includes(q)) best = Math.max(best, 40);
    }
    if (best > 0) scored.push({ ...item, score: best });
  }
  scored.sort((a, b) => b.score - a.score || a.e.localeCompare(b.e));
  // unique emoji
  const seen = new Set();
  const out = [];
  for (const s of scored) {
    if (seen.has(s.e)) continue;
    seen.add(s.e);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function getShortcodeAt(text, cursor) {
  const pos = cursor == null ? text.length : cursor;
  const before = text.slice(0, pos);
  // :query  (no spaces; min 1 char after colon for suggestions)
  const m = before.match(/:([^\s:]{1,40})$/);
  if (!m) return null;
  return {
    query: m[1],
    start: before.length - m[0].length,
    end: pos,
  };
}


const HOLD_MS = 180; // short press = switch mode; longer = start record
const LOCK_DY = -56; // drag up this many px → lock
const CANCEL_DX = -72; // drag left this many px → cancel

/**
 * Telegram-style composer:
 *  - Hold mic/cam to record, slide up to lock, slide left to cancel
 *  - Tap the secondary media button to swap voice ↔ video
 *  - Send button only when there is text/files/edit; otherwise media button
 *  - Enter still sends (desktop + mobile keyboard)
 */
export default function MessageComposer({
  text, setText, files, setFiles,
  replyTo, editingMsg, onCancelReplyOrEdit,
  onSend, onPickImage, onPickVideo, onEditAttachment, inputRef, onKeyDown,
  sendFilesTogether = true, setSendFilesTogether,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const fileRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [scQuery, setScQuery] = useState(null); // { query, start, end }
  const [scIndex, setScIndex] = useState(0);
  const scMatches = React.useMemo(
    () => (scQuery ? matchEmojis(scQuery.query) : []),
    [scQuery],
  );

  // "voice" | "video" — which mode the primary hold-button uses
  const [mediaMode, setMediaMode] = useState(() => {
    try { return localStorage.getItem("messenger.mediaMode") || "voice"; } catch { return "voice"; }
  });

  // Recording: idle | recording | locked
  const [recPhase, setRecPhase] = useState("idle"); // idle | holding | locked
  const [recKind, setRecKind] = useState("voice"); // voice | video
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState("");
  const [locked, setLocked] = useState(false);
  const [hint, setHint] = useState(""); // "Slide up to lock" / "Release to cancel"
  const [dragUI, setDragUI] = useState({ dx: 0, dy: 0 });

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micRafRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);

  const holdTimerRef = useRef(null);
  const pressStartRef = useRef(null); // { x, y, mode, started }
  const pointerIdRef = useRef(null);
  const lockedRef = useRef(false);
  const cancelRef = useRef(false);
  const suppressModeToggleClickRef = useRef(false);

  const stopMicMeter = () => {
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setMicLevel(0);
  };

  const startMicMeter = (stream) => {
    stopMicMeter();
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);
      let peakHold = 0;
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / data.length);
        const boosted = Math.min(1, Math.pow(rms * 4.5, 0.65));
        peakHold = Math.max(boosted, peakHold * 0.92);
        setMicLevel(peakHold);
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* */ }
  };

  const stopAllTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch { /* */ }
      });
      streamRef.current = null;
    }
    stopMicMeter();
  };

  useEffect(() => () => {
    stopAllTracks();
    stopMicMeter();
    if (timerRef.current) clearInterval(timerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("messenger.mediaMode", mediaMode); } catch { /* */ }
  }, [mediaMode]);

  // Attach live stream to circular preview once the video element mounts
  useEffect(() => {
    if ((recPhase === "holding" || recPhase === "locked") && recKind === "video") {
      const v = videoPreviewRef.current;
      if (v && streamRef.current) {
        v.srcObject = streamRef.current;
        v.play().catch(() => {});
      }
    }
  }, [recPhase, recKind]);

  const getSavedDevices = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("messenger.mediaDevices") || "{}");
      return { cameraId: saved.cameraId || "", micId: saved.micId || "" };
    } catch {
      return { cameraId: "", micId: "" };
    }
  };

  const beginRecording = useCallback(async (mode) => {
    setRecordError("");
    setLocked(false);
    lockedRef.current = false;
    cancelRef.current = false;
    setHint("Slide up to lock · left to cancel");
    setDragUI({ dx: 0, dy: 0 });
    try {
      const { cameraId, micId } = getSavedDevices();
      const audioConstraint = micId ? { deviceId: { exact: micId } } : true;
      const videoConstraint = mode === "video"
        ? {
            width: { ideal: 320 },
            height: { ideal: 320 },
            ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
          }
        : false;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: audioConstraint,
      });
      // User may have cancelled during permission prompt
      if (cancelRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      startMicMeter(stream);

      if (mode === "video" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      const mimeType = mode === "video" ? "video/webm" : "audio/webm";
      const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : {};
      const mr = new MediaRecorder(stream, options);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const wasCancel = cancelRef.current;
        const recordedType = mr.mimeType || mimeType;
        const blob = new Blob(chunksRef.current, { type: recordedType });
        stopAllTracks();
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecPhase("idle");
        setLocked(false);
        lockedRef.current = false;
        setHint("");
        setDragUI({ dx: 0, dy: 0 });
        setRecordSeconds(0);

        if (wasCancel || !blob.size) {
          if (!wasCancel && !blob.size) setRecordError("Recording was empty");
          return;
        }
        const ts = Date.now();
        const filename = mode === "video" ? `video_message_${ts}.webm` : `voice_${ts}.webm`;
        const file = new File([blob], filename, { type: recordedType });
        // flushSync so parent onSend sees the new file in state immediately
        flushSync(() => {
          setFiles((prev) => [...prev, file]);
        });
        try { onSend?.(); } catch { /* */ }
      };
      mediaRecorderRef.current = mr;
      mr.start(100);
      setRecKind(mode);
      setRecPhase("holding");
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (mode === "video" && s + 1 >= 60) {
            // auto-stop video at 60s
            setTimeout(() => stopRecording(false), 0);
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      setRecordError(
        e?.name === "NotAllowedError"
          ? "Microphone/camera permission denied"
          : (e?.message || "Recording unavailable")
      );
      stopAllTracks();
      setRecPhase("idle");
    }
  }, [onSend, setFiles]);

  const stopRecording = useCallback((cancel = false) => {
    cancelRef.current = !!cancel;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    } else {
      stopAllTracks();
      setRecPhase("idle");
      setLocked(false);
      lockedRef.current = false;
      setHint("");
      setRecordSeconds(0);
    }
    mediaRecorderRef.current = null;
  }, []);

  const cancelRecording = useCallback(() => {
    stopRecording(true);
  }, [stopRecording]);

  /* ---------- pointer handlers for hold-to-record ---------- */
  const onMediaPointerDown = (e, mode) => {
    if (recPhase !== "idle") return;
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    pointerIdRef.current = e.pointerId;
    pressStartRef.current = { x: clientX, y: clientY, mode, started: false };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* */ }

    holdTimerRef.current = setTimeout(() => {
      if (!pressStartRef.current) return;
      pressStartRef.current.started = true;
      suppressModeToggleClickRef.current = true;
      beginRecording(mode);
    }, HOLD_MS);

    const onMove = (ev) => {
      const start = pressStartRef.current;
      if (!start) return;
      const x = ev.clientX ?? ev.touches?.[0]?.clientX;
      const y = ev.clientY ?? ev.touches?.[0]?.clientY;
      if (x == null || y == null) return;
      const dx = x - start.x;
      const dy = y - start.y;
      setDragUI({ dx, dy });

      if (!start.started) {
        // moved a lot before hold fired → cancel pending start
        if (Math.abs(dx) > 24 || Math.abs(dy) > 24) {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
        }
        return;
      }

      if (lockedRef.current) return;

      if (dy <= LOCK_DY) {
        // Lock
        lockedRef.current = true;
        setLocked(true);
        setRecPhase("locked");
        setHint("Locked · tap send when done");
        setDragUI({ dx: 0, dy: 0 });
        cleanupPointer(onMove, onUp);
        return;
      }
      if (dx <= CANCEL_DX) {
        setHint("Release to cancel");
      } else if (dy < -12) {
        setHint("Slide up to lock");
      } else {
        setHint("Slide up to lock · left to cancel");
      }
    };

    const onUp = () => {
      cleanupPointer(onMove, onUp);
      const start = pressStartRef.current;
      pressStartRef.current = null;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      // Short tap without starting → switch mode if this was secondary? handled separately
      if (!start?.started) {
        return;
      }

      if (lockedRef.current) {
        // Already locked — release shouldn't stop
        return;
      }

      // If dragged far left → cancel
      if (dragUI.dx <= CANCEL_DX || (start && false)) {
        // use latest drag from event — check cancel via release position not stored
      }

      // Default: stop & send
      // Cancel if still near cancel zone — read from last dragUI state is stale;
      // rely on cancelRef set during move
      stopRecording(false);
    };

    const cleanupPointer = (m, u) => {
      window.removeEventListener("pointermove", m);
      window.removeEventListener("pointerup", u);
      window.removeEventListener("pointercancel", u);
      window.removeEventListener("touchmove", m);
      window.removeEventListener("touchend", u);
    };

    // Track cancel zone on move with a ref for up handler
    const onMoveWrap = (ev) => {
      onMove(ev);
      const start = pressStartRef.current;
      if (!start?.started || lockedRef.current) return;
      const x = ev.clientX ?? ev.touches?.[0]?.clientX;
      if (x != null && start && (x - start.x) <= CANCEL_DX) {
        cancelRef.current = true; // mark for cancel if released here
      } else if (!lockedRef.current) {
        cancelRef.current = false;
      }
    };

    const onUpWrap = () => {
      cleanupPointer(onMoveWrap, onUpWrap);
      const start = pressStartRef.current;
      const wasStarted = start?.started;
      pressStartRef.current = null;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (!wasStarted) return;
      if (lockedRef.current) return;
      stopRecording(!!cancelRef.current);
    };

    window.addEventListener("pointermove", onMoveWrap);
    window.addEventListener("pointerup", onUpWrap);
    window.addEventListener("pointercancel", onUpWrap);
  };

  const switchMode = (mode) => {
    setMediaMode(mode);
  };


  const updateShortcodeFromText = (value, cursor) => {
    const sc = getShortcodeAt(value, cursor);
    if (!sc) {
      setScQuery(null);
      setScIndex(0);
      return;
    }
    setScQuery(sc);
    setScIndex(0);
  };

  const applyShortcodeEmoji = (emoji) => {
    if (!scQuery) return;
    const { start, end } = scQuery;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    setText(next);
    setScQuery(null);
    setScIndex(0);
    // restore caret after emoji
    requestAnimationFrame(() => {
      const el = inputRef?.current;
      if (el && typeof el.setSelectionRange === "function") {
        const pos = start + emoji.length;
        try { el.setSelectionRange(pos, pos); } catch { /* */ }
        el.focus();
      }
    });
  };

  const onTextChange = (e) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setText(value);
    updateShortcodeFromText(value, cursor);
  };

  const handleComposerKeyDown = (e) => {
    if (scMatches.length > 0 && scQuery) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setScIndex((i) => (i + 1) % scMatches.length);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setScIndex((i) => (i - 1 + scMatches.length) % scMatches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const pick = scMatches[scIndex] || scMatches[0];
        if (pick) applyShortcodeEmoji(pick.e);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setScQuery(null);
        setScIndex(0);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const [fileDragOver, setFileDragOver] = useState(false);

  const addPickedFiles = (list) => {
    const picked = Array.from(list || []).filter(Boolean);
    if (!picked.length) return;
    setFiles((prev) => [...prev, ...picked]);
    // Open image/video editor for first media file if single image/video
    // (caller can edit via strip). Keep all in list.
  };

  const onDragOverFiles = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes("Files")) setFileDragOver(true);
  };
  const onDragLeaveFiles = (e) => {
    e.preventDefault();
    // only clear when leaving the composer root
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setFileDragOver(false);
  };
  const onDropFiles = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(false);
    const list = e.dataTransfer?.files;
    if (list?.length) addPickedFiles(list);
  };

  const handleFileChange = (e) => {
    addPickedFiles(e.target.files);
    e.target.value = "";
  };

  const thumbUrl = (f) => {
    try {
      if (f?.type?.startsWith("image/") || f?.type?.startsWith("video/")) {
        return URL.createObjectURL(f);
      }
    } catch { /* */ }
    return null;
  };

  const formatRecTime = (s) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const canSend = Boolean(text.trim() || files.length || editingMsg);
  const primaryMode = mediaMode; // "voice" | "video"

  /* ---------- locked / holding recording UI ---------- */
  if (recPhase === "holding" || recPhase === "locked") {
    const showLock = locked || recPhase === "locked";
    return (
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper", p: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {recKind === "video" && (
            <Box
              component="video"
              ref={videoPreviewRef}
              muted
              playsInline
              sx={{
                width: 52, height: 52, borderRadius: "50%",
                objectFit: "cover", border: "2px solid", borderColor: "error.main", flexShrink: 0,
              }}
            />
          )}

          <IconButton onClick={cancelRecording} title="Cancel">
            <DeleteOutlineIcon color="error" />
          </IconButton>

          <Box sx={{
            flex: 1, minWidth: 0,
            bgcolor: "action.hover", borderRadius: 3, px: 1.5, py: 0.75,
            transform: !showLock ? `translateX(${Math.min(0, dragUI.dx * 0.35)}px)` : "none",
            transition: showLock ? "transform 0.15s" : "none",
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{
                width: 10, height: 10, borderRadius: "50%", bgcolor: "error.main", flexShrink: 0,
                animation: "pulse 1.2s infinite",
                "@keyframes pulse": {
                  "0%": { opacity: 1 },
                  "50%": { opacity: 0.35 },
                  "100%": { opacity: 1 },
                },
              }} />
              <Typography variant="body2" fontWeight={700} noWrap>
                {formatRecTime(recordSeconds)}
              </Typography>
              {showLock ? (
                <LockOutlinedIcon sx={{ fontSize: 16, color: "warning.main" }} />
              ) : (
                <LockOpenOutlinedIcon sx={{ fontSize: 16, color: "text.secondary", opacity: 0.7 }} />
              )}
              <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                {hint}
              </Typography>
            </Stack>
            <Box sx={{
              mt: 0.5, width: "100%", height: 5, borderRadius: 3,
              bgcolor: "action.selected", overflow: "hidden", position: "relative",
            }}>
              <Box sx={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${Math.min(100, Math.round(micLevel * 100))}%`,
                bgcolor: micLevel > 0.85 ? "error.main" : micLevel > 0.55 ? "warning.main" : "success.main",
                transition: "width 0.04s linear",
              }} />
            </Box>
          </Box>

          {/* Lock affordance (visual) while holding */}
          {!showLock && (
            <Box sx={{
              display: "flex", flexDirection: "column", alignItems: "center",
              opacity: 0.55 + Math.min(0.45, Math.max(0, -dragUI.dy) / 56),
              transform: `translateY(${Math.max(LOCK_DY, Math.min(0, dragUI.dy)) * 0.3}px)`,
            }}>
              <KeyboardArrowUpIcon fontSize="small" color="action" />
              <LockOutlinedIcon sx={{ fontSize: 18 }} color="action" />
            </Box>
          )}

          {showLock && (
            <IconButton
              color="primary"
              onClick={() => stopRecording(false)}
              sx={{
                bgcolor: "primary.main", color: "#fff",
                "&:hover": { bgcolor: "primary.dark" },
              }}
              title="Send"
            >
              <SendIcon />
            </IconButton>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        bgcolor: "background.paper",
        outline: fileDragOver ? "2px dashed" : "none",
        outlineColor: "primary.main",
        outlineOffset: -2,
        transition: "outline-color 0.15s",
      }}
      onDragEnter={onDragOverFiles}
      onDragOver={onDragOverFiles}
      onDragLeave={onDragLeaveFiles}
      onDrop={onDropFiles}
    >
      {/* Shortcode emoji island (Telegram-style) */}
      {scMatches.length > 0 && scQuery && (
        <Box
          sx={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: "100%",
            mb: 0.75,
            zIndex: 30,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2.5,
            boxShadow: 8,
            px: 1,
            py: 0.75,
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
            scrollbarWidth: "thin",
          }}
        >
          <Stack direction="row" spacing={0.75} sx={{ width: "max-content" }}>
            {scMatches.map((m, i) => (
              <Box
                key={`${m.e}-${i}`}
                onMouseDown={(ev) => {
                  // prevent input blur before click applies
                  ev.preventDefault();
                  applyShortcodeEmoji(m.e);
                }}
                sx={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  borderRadius: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  cursor: "pointer",
                  userSelect: "none",
                  bgcolor: i === scIndex ? (t) => alpha(t.palette.primary.main, 0.16) : "action.hover",
                  outline: i === scIndex ? "2px solid" : "1px solid",
                  outlineColor: i === scIndex ? "primary.main" : "divider",
                  transition: "background-color 0.12s, outline-color 0.12s",
                }}
              >
                {m.e}
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {(replyTo || editingMsg) && (
        <Stack direction="row" alignItems="center"
          sx={{ px: 1.5, py: 0.7, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
          {editingMsg
            ? <EditIcon fontSize="small" sx={{ mr: 1, color: "warning.main" }} />
            : <ReplyIcon fontSize="small" sx={{ mr: 1 }} />}
          <Box sx={{ flex: 1, minWidth: 0, borderLeft: "3px solid",
              borderColor: editingMsg ? "warning.main" : "primary.main", pl: 1 }}>
            <Typography variant="caption" fontWeight={700}>
              {editingMsg ? "Edit message" : `Reply to ${replyTo?.sender?.username || ""}`}
            </Typography>
            <Typography variant="caption" display="block" noWrap color="text.secondary">
              {editingMsg ? editingMsg.body : replyTo?.body}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onCancelReplyOrEdit}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      {fileDragOver && (
        <Box sx={{
          px: 1.5, py: 1,
          bgcolor: (t) => t.palette.mode === "dark" ? "rgba(25,118,210,0.2)" : "rgba(25,118,210,0.08)",
          borderBottom: "1px solid",
          borderColor: "primary.main",
          textAlign: "center",
        }}>
          <Typography variant="caption" color="primary" fontWeight={700}>
            Drop files to attach
          </Typography>
        </Box>
      )}
      {files.length > 0 && (
        <Box sx={{ bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.25, pt: 0.75, pb: 0.25 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {files.length} {files.length === 1 ? "file" : "files"} selected
            </Typography>
            {setSendFilesTogether && files.length > 1 && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <input
                  id="messenger-send-files-together"
                  type="checkbox"
                  checked={sendFilesTogether}
                  onChange={(e) => setSendFilesTogether(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <Typography
                  component="label"
                  htmlFor="messenger-send-files-together"
                  variant="caption"
                  sx={{ cursor: "pointer", userSelect: "none" }}
                >
                  Send all in one message
                </Typography>
              </Stack>
            )}
          </Stack>
          <Box sx={{
            px: 1, pt: 0.5, pb: 0.75,
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": { height: 4 },
          }}>
          <Stack direction="row" spacing={1} sx={{ width: "max-content", pr: 1 }}>
            {files.map((f, i) => {
              const url = thumbUrl(f);
              const isImg = f.type?.startsWith("image/");
              const isVid = f.type?.startsWith("video/");
              return (
                <Box
                  key={`${f.name}-${f.size}-${i}`}
                  onClick={() => {
                    if ((isImg || isVid) && onEditAttachment) onEditAttachment(f, i);
                  }}
                  sx={{
                    position: "relative",
                    width: 72, height: 72, flexShrink: 0,
                    borderRadius: 2,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "action.hover",
                    cursor: (isImg || isVid) ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {url ? (
                    isVid ? (
                      <Box
                        component="video"
                        src={url}
                        muted
                        playsInline
                        sx={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                      />
                    ) : (
                      <Box
                        component="img"
                        src={url}
                        alt=""
                        sx={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                      />
                    )
                  ) : (
                    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {f.name?.startsWith("voice_") ? <MicIcon /> : f.name?.startsWith("video_message_") ? <VideocamIcon /> : <AttachFileIcon />}
                    </Box>
                  )}
                  {isVid && (
                    <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.25)", pointerEvents: "none" }}>
                      <VideocamIcon sx={{ color: "#fff", fontSize: 22 }} />
                    </Box>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles((prev) => prev.filter((_, j) => j !== i));
                    }}
                    sx={{
                      position: "absolute", top: 2, right: 2,
                      width: 28, height: 28, p: 0,
                      bgcolor: "rgba(0,0,0,0.55)", color: "#fff",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Box>
              );
            })}
          </Stack>
          </Box>
        </Box>
      )}

      <Stack direction="row" alignItems="center" spacing={isMobile ? 0.15 : 0.5}
        sx={{
          p: isMobile ? 0.75 : 1,
          bgcolor: "background.paper",
          borderTop: files.length ? "none" : "1px solid",
          borderColor: "divider",
        }}>
        <input
          ref={fileRef} type="file" multiple hidden
          accept="image/*,video/*,audio/*,.gif,.pdf,.txt,.zip,.doc,.docx,.md,.csv"
          onChange={handleFileChange}
        />
        {!editingMsg && (
          <Tooltip title="Attach files">
            <IconButton
              onClick={() => fileRef.current?.click()}
              size="small"
              sx={{
                p: isMobile ? 0.5 : 1,
                mr: isMobile ? -0.25 : 0,
                alignSelf: "center",
              }}
            >
              <AttachFileIcon sx={{ fontSize: isMobile ? 20 : 24 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Emoji">
          <IconButton
            ref={emojiBtnRef}
            onClick={() => setEmojiOpen(true)}
            size="small"
            sx={{
              p: isMobile ? 0.5 : 1,
              ml: isMobile ? -0.5 : 0,
              alignSelf: "center",
            }}
          >
            <EmojiEmotionsIcon sx={{ fontSize: isMobile ? 20 : 24 }} />
          </IconButton>
        </Tooltip>
        <Popover
          open={emojiOpen}
          anchorEl={emojiBtnRef.current}
          onClose={() => setEmojiOpen(false)}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          PaperProps={{ sx: { p: 1.5, maxHeight: 320, overflow: "auto" } }}
        >
          {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => (
            <Box key={cat} sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
                {cat}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25, maxWidth: 280 }}>
                {emojis.map((em) => (
                  <IconButton
                    key={em}
                    size="small"
                    onClick={() => {
                      setText((t) => t + em);
                      inputRef?.current?.focus();
                    }}
                    sx={{ fontSize: 22, width: 36, height: 36 }}
                  >
                    {em}
                  </IconButton>
                ))}
              </Box>
            </Box>
          ))}
        </Popover>
        {editingMsg && (
          <IconButton onClick={() => {
            setText("");
            onCancelReplyOrEdit?.();
          }} title="Cancel edit">
            <CloseIcon color="warning" />
          </IconButton>
        )}
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={isMobile ? 5 : 8}
          minRows={1}
          size="small"
          placeholder={editingMsg ? "Edit message…" : "Message"}
          value={text}
          onChange={onTextChange}
          onKeyDown={handleComposerKeyDown}
          onSelect={(e) => {
            const el = e.target;
            updateShortcodeFromText(el.value, el.selectionStart);
          }}
          onClick={(e) => {
            const el = e.target;
            updateShortcodeFromText(el.value, el.selectionStart);
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              bgcolor: "action.hover",
              alignItems: "center",
              py: isMobile ? 0.35 : 0.5,
            },
            "& textarea": {
              lineHeight: 1.4,
            },
          }}
        />

        {/* When there is something to send → Send. Otherwise Telegram-style media buttons. */}
        {canSend ? (
          <IconButton
            color="primary"
            onClick={onSend}
            sx={{
              bgcolor: "primary.main", color: "#fff",
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            {editingMsg ? <DoneIcon /> : <SendIcon />}
          </IconButton>
        ) : (
          <Tooltip title={primaryMode === "voice" ? "Tap for video · hold to record voice" : "Tap for voice · hold to record video"}>
            <IconButton
              color="primary"
              onPointerDown={(e) => onMediaPointerDown(e, primaryMode)}
              onClick={() => {
                if (suppressModeToggleClickRef.current) {
                  suppressModeToggleClickRef.current = false;
                  return;
                }
                switchMode(primaryMode === "voice" ? "video" : "voice");
              }}
              onContextMenu={(e) => e.preventDefault()}
              sx={{
                width: 42, height: 42,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            >
              {primaryMode === "voice" ? <MicIcon /> : <VideocamIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {recordError && (
        <Typography variant="caption" color="error.main" sx={{ px: 1, pb: 0.5, display: "block" }}>
          {recordError}
        </Typography>
      )}
    </Box>
  );
}

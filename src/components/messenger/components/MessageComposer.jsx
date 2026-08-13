import React, { useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import {
  Stack, TextField, IconButton, Box, Chip, Tooltip, Typography,
  Popover, alpha, useMediaQuery, List, ListItemButton, ListItemAvatar, ListItemText, Avatar,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ImageIcon from "@mui/icons-material/Image";
import MovieIcon from "@mui/icons-material/Movie";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import SendIcon from "@mui/icons-material/Send";
import DoneIcon from "@mui/icons-material/Done";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ReplyIcon from "@mui/icons-material/Reply";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import MicIcon from "@mui/icons-material/Mic";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import VideocamIcon from "@mui/icons-material/Videocam";
import CameraswitchIcon from "@mui/icons-material/Cameraswitch";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import CodeIcon from "@mui/icons-material/Code";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import ComposeCodeWorkspace, {
  ComposeQuoteEditor,
  filesToMarkdown,
  markdownToFiles,
} from "./ComposeCodeWorkspace";
import Button from "@mui/material/Button";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";

import { withTokenQuery } from "../messengerUtils";

const EMOJI_CATEGORIES = {
  Smileys: ["😀", "😂", "🤣", "😍", "🥰", "😎", "🤩", "🥳", "😭", "😢", "😡", "🤬", "🤔", "😴", "🤯", "🥺", "😇", "🤗", "🙄", "😏", "😬", "😶", "🫡", "🫠"],
  Gestures: ["👍", "👎", "👏", "🙏", "💪", "✌️", "🤞", "🤟", "👌", "🙌", "👋", "✋", "🤙", "👊", "🤝", "🫶", "👀", "💀"],
  Hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💖", "💘", "💝"],
  Objects: ["🔥", "⭐", "✨", "🎉", "🎊", "🏆", "🥇", "💎", "🚀", "💡", "🎵", "🎁", "🎂", "☕", "🍕", "🍔", "🍺", "📚", "📱", "💻"],
  Nature: ["☀️", "🌙", "🌈", "☔", "🌸", "🌹", "🌻", "🐶", "🐱", "🐻", "🐼", "🦊", "🦁", "🐸", "🦋"],
  Symbols: ["✅", "❌", "❓", "❗", "⚠️", "💯", "♻️", "🌐", "💤", "💥", "📌", "🔗"],
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

function getMentionAt(text, cursor) {
  const pos = cursor == null ? text.length : cursor;
  const before = text.slice(0, pos);
  // @query at the caret; query may be empty so typing only "@" opens suggestions.
  const m = before.match(/(?:^|\s)(@([^\s@]{0,40}))$/);
  if (!m) return null;
  return {
    query: m[2] || "",
    start: before.length - m[1].length,
    end: pos,
  };
}

function matchMentions(users, query, limit = 16) {
  const q = normalizeQuery(query);
  const unique = new Map();
  for (const raw of Array.isArray(users) ? users : []) {
    const username = String(raw?.username || raw?.user?.username || "").trim().replace(/^@/, "");
    if (!username) continue;
    const key = username.toLowerCase();
    if (unique.has(key)) continue;
    const label = String(raw?.display_name || raw?.full_name || raw?.name || raw?.user?.display_name || username).trim();
    let score = 20;
    if (!q) score = 60;
    else if (key === q) score = 120;
    else if (key.startsWith(q)) score = 100 - Math.max(0, key.length - q.length);
    else if (key.includes(q)) score = 50;
    else continue;
    unique.set(key, {
      ...raw,
      username,
      label: label || username,
      score,
    });
  }
  return Array.from(unique.values())
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
    .slice(0, limit);
}


const HOLD_MS = 180; // short press = switch mode; longer = start record
const LOCK_DY = -40; // drag up this many px → lock
const CANCEL_DX = -72; // drag left this many px → cancel

/**
 * Telegram-style composer:
 *  - Hold mic/cam to record, slide up to lock, slide left to cancel
 *  - Tap the secondary media button to swap voice ↔ video
 *  - Send button only when there is text/files/edit; otherwise media button
 *  - Desktop: Enter sends · Mobile: Enter = new line (Send button only)
 */

/** Extract fenced code blocks and quote runs from composer text for live preview. */
function extractComposeBlocks(raw) {
  const s = raw || "";
  const blocks = [];
  const fenceRe = /```([\w+-]*)(?::([^\n`]*))?\n?([\s\S]*?)```/g;
  let m;
  let i = 0;
  while ((m = fenceRe.exec(s)) !== null) {
    blocks.push({
      type: "codeblock",
      index: i++,
      lang: (m[1] || "").trim(),
      name: (m[2] || "").trim(),
      code: m[3].replace(/^\n/, "").replace(/\n$/, ""),
      full: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  const lines = s.split("\n");
  let qStart = null;
  let qLines = [];
  let offset = 0;
  const lineStarts = [];
  for (let li = 0; li < lines.length; li++) {
    lineStarts.push(offset);
    offset += lines[li].length + 1;
  }
  const flushQ = () => {
    if (!qLines.length) return;
    const start = lineStarts[qStart];
    const last = qStart + qLines.length - 1;
    const end = lineStarts[last] + lines[last].length;
    blocks.push({
      type: "quote",
      index: i++,
      text: qLines.join("\n"),
      start,
      end,
    });
    qLines = [];
    qStart = null;
  };
  for (let li = 0; li < lines.length; li++) {
    if (/^>\s?/.test(lines[li])) {
      if (qStart == null) qStart = li;
      qLines.push(lines[li].replace(/^>\s?/, ""));
    } else {
      flushQ();
    }
  }
  flushQ();
  blocks.sort((a, b) => a.start - b.start);
  return blocks;
}


function replaceQuoteBlock(raw, start, end, quoteText) {
  const block = String(quoteText || "")
    .split("\n")
    .map((l) => (l.startsWith("> ") ? l : `> ${l}`))
    .join("\n");
  return (raw || "").slice(0, start) + block + (raw || "").slice(end);
}

/** Split message into prefix / code files / suffix for the multi-file workspace. */
function splitMarkdownCode(raw) {
  const s = raw || "";
  const re = /```[\w+-]*(?::[^\n`]*)?\n?[\s\S]*?```/g;
  const files = markdownToFiles(s);
  if (!files.length) return { prefix: s, files: [], suffix: "" };
  let first = -1;
  let lastEnd = 0;
  let m;
  const re2 = /```[\w+-]*(?::[^\n`]*)?\n?[\s\S]*?```/g;
  while ((m = re2.exec(s)) !== null) {
    if (first < 0) first = m.index;
    lastEnd = m.index + m[0].length;
  }
  return {
    prefix: s.slice(0, first).replace(/\s+$/, ""),
    suffix: s.slice(lastEnd).replace(/^\s+/, ""),
    files,
  };
}

function joinMarkdownCode(prefix, files, suffix) {
  const mid = filesToMarkdown(files);
  return [prefix, mid, suffix].filter((x) => x && String(x).length).join("\n\n");
}

export default function MessageComposer({

  text, setText, files, setFiles,
  replyTo, editingMsg, onCancelReplyOrEdit,
  onSend, onPickImage, onPickVideo, onEditAttachment, inputRef, onKeyDown,
  sendFilesTogether = true, setSendFilesTogether,
  mentionUsers = [],
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
  const [mentionQuery, setMentionQuery] = useState(null); // { query, start, end }
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionMatches = React.useMemo(
    () => (mentionQuery ? matchMentions(mentionUsers, mentionQuery.query) : []),
    [mentionQuery, mentionUsers],
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

  // Selfie by default for video messages; flip switches to environment (rear).
  const [cameraFacing, setCameraFacing] = useState(() => {
    try { return localStorage.getItem("messenger.videoFacing") || "user"; } catch { return "user"; }
  });
  const cameraFacingRef = useRef(cameraFacing);
  useEffect(() => { cameraFacingRef.current = cameraFacing; }, [cameraFacing]);
  const [flippingCam, setFlippingCam] = useState(false);

  // Right-click format menu on the text field
  const [fmtMenu, setFmtMenu] = useState(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const [attachMenuAnchor, setAttachMenuAnchor] = useState(null);
  const [attachAccept, setAttachAccept] = useState("image/*,image/gif,.gif,video/*,audio/*,.pdf,.txt,.zip,.doc,.docx,.md,.csv");
  const [attachCapture, setAttachCapture] = useState(undefined); // { mouseX, mouseY, start, end }
  // PDF / TXT preview dialog for pending attachments
  const [filePreview, setFilePreview] = useState(null); // { name, kind: 'pdf'|'txt', url?, text? }


  const getSavedDevices = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("messenger.mediaDevices") || "{}");
      return {
        cameraId: saved.cameraId || "",
        micId: saved.micId || "",
        speakerId: saved.speakerId || "",
      };
    } catch {
      return { cameraId: "", micId: "", speakerId: "" };
    }
  };

  /**
   * Build getUserMedia constraints. Prefer saved deviceId; always fall back to
   * facingMode so a missing/unplugged device does not block recording.
   * Video messages ALWAYS start as selfie (facingMode: user) unless the user
   * has already flipped during this session (cameraFacingRef).
   */
  const buildMediaConstraints = (mode, facingOverride) => {
    const { cameraId, micId } = getSavedDevices();
    const audioConstraint = micId
      ? { deviceId: { ideal: micId } }
      : true;

    if (mode !== "video") {
      return { video: false, audio: audioConstraint };
    }

    const facing = facingOverride || cameraFacingRef.current || "user";
    const videoConstraint = {
      width: { ideal: 480 },
      height: { ideal: 480 },
      facingMode: { ideal: facing },
    };
    if (cameraId) {
      // Prefer exact so desktop actually opens the camera chosen in settings.
      // beginRecording falls back if this fails.
      videoConstraint.deviceId = { exact: cameraId };
    }
    return { video: videoConstraint, audio: audioConstraint };
  };

  /**
   * Start (or restart after camera flip) a MediaRecorder on the given stream.
   * Chunks accumulate in chunksRef so a mid-recording camera flip does not lose data.
   */
  const startMediaRecorderOnStream = (stream, mode) => {
    const mimeType = mode === "video" ? "video/webm" : "audio/webm";
    const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : {};
    // If an old recorder is still alive (e.g. during flip), flush remaining data then
    // stop it without running finalization so chunks stay in chunksRef.
    const prev = mediaRecorderRef.current;
    if (prev && prev.state !== "inactive") {
      try {
        prev.onstop = null;
        try { prev.requestData(); } catch { /* */ }
        prev.stop();
      } catch { /* */ }
    }

    const mr = new MediaRecorder(stream, options);
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      // Ignore intermediate stops from camera-flip restarts
      if (mediaRecorderRef.current !== mr) return;
      mediaRecorderRef.current = null;

      const wasCancel = cancelRef.current;
      const recordedType = mr.mimeType || mimeType;
      const blob = new Blob(chunksRef.current, { type: recordedType });
      chunksRef.current = [];
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
      flushSync(() => {
        setFiles((prev) => [...prev, file]);
      });
      try { onSend?.(); } catch { /* */ }
    };
    mediaRecorderRef.current = mr;
    mr.start(100);
    return mr;
  };

  /**
   * Flip front/rear camera WITHOUT stopping the voice track or discarding
   * already-recorded chunks. Stopping the old video track used to end the
   * MediaRecorder (browser fires track-ended → recorder stop). We now:
   *  1) acquire the opposite camera
   *  2) build a fresh MediaStream (new video + existing audio tracks)
   *  3) restart MediaRecorder on that stream while keeping chunksRef
   *  4) only then stop the previous video track
   */
  const flipCamera = async () => {
    if (recKind !== "video" || flippingCam || !streamRef.current) return;
    setFlippingCam(true);
    setRecordError("");
    const nextFacing = cameraFacingRef.current === "user" ? "environment" : "user";
    const oldStream = streamRef.current;
    let newVideoStream = null;
    try {
      let videoConstraints = {
        facingMode: { ideal: nextFacing },
        width: { ideal: 480 },
        height: { ideal: 480 },
      };
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        if (cams.length > 1) {
          const currentId = oldStream.getVideoTracks()[0]?.getSettings?.()?.deviceId;
          const other = cams.find((c) => c.deviceId && c.deviceId !== currentId);
          const byLabel = cams.find((c) => {
            const lab = (c.label || "").toLowerCase();
            if (nextFacing === "user") {
              return /front|user|face|selfie|\u062c\u0644\u0648/.test(lab);
            }
            return /back|rear|environment|world|\u0639\u0642\u0628|\u067e\u0634\u062a/.test(lab);
          });
          const pick = byLabel || other;
          if (pick?.deviceId) {
            videoConstraints = {
              deviceId: { ideal: pick.deviceId },
              facingMode: { ideal: nextFacing },
              width: { ideal: 480 },
              height: { ideal: 480 },
            };
          }
        }
      } catch { /* enumerate optional */ }

      newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      const newTrack = newVideoStream.getVideoTracks()[0];
      if (!newTrack) {
        newVideoStream.getTracks().forEach((t) => { try { t.stop(); } catch {} });
        throw new Error("No video track from new camera");
      }

      // Keep existing live audio tracks
      const audioTracks = oldStream.getAudioTracks().filter((t) => t.readyState === "live");
      const combined = new MediaStream([newTrack, ...audioTracks]);

      // Restart recorder on the new stream BEFORE stopping the old video track
      startMediaRecorderOnStream(combined, "video");
      streamRef.current = combined;

      // Release previous camera
      oldStream.getVideoTracks().forEach((t) => {
        try { oldStream.removeTrack(t); } catch { /* */ }
        try { t.stop(); } catch { /* */ }
      });
      newVideoStream.getTracks().forEach((t) => {
        if (t !== newTrack) {
          try { t.stop(); } catch { /* */ }
        }
      });

      setCameraFacing(nextFacing);
      cameraFacingRef.current = nextFacing;
      try { localStorage.setItem("messenger.videoFacing", nextFacing); } catch { /* */ }

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = combined;
        videoPreviewRef.current.play().catch(() => {});
      }
    } catch (e) {
      if (newVideoStream) {
        newVideoStream.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      }
      setRecordError(e?.message || "Could not switch camera");
    } finally {
      setFlippingCam(false);
    }
  };

  const beginRecording = useCallback(async (mode) => {
    setRecordError("");
    setLocked(false);
    lockedRef.current = false;
    cancelRef.current = false;
    setHint("Slide up to lock · left to cancel");
    setDragUI({ dx: 0, dy: 0 });
    // Video messages always open on the selfie (front) camera
    if (mode === "video") {
      setCameraFacing("user");
      cameraFacingRef.current = "user";
      try { localStorage.setItem("messenger.videoFacing", "user"); } catch { /* */ }
    }
    try {
      const constraints = buildMediaConstraints(mode, mode === "video" ? "user" : undefined);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        // Stale deviceId / constraint failure → retry without deviceId
        if (mode === "video" || constraints.audio?.deviceId) {
          const fallback = {
            video: mode === "video"
              ? {
                  width: { ideal: 480 },
                  height: { ideal: 480 },
                  facingMode: { ideal: "user" },
                }
              : false,
            audio: true,
          };
          stream = await navigator.mediaDevices.getUserMedia(fallback);
        } else {
          throw firstErr;
        }
      }
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

      chunksRef.current = [];
      startMediaRecorderOnStream(stream, mode);
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
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      // Do NOT null mediaRecorderRef here — onstop checks identity against
      // mediaRecorderRef to ignore intermediate stops from camera flips.
      try { mr.stop(); } catch { /* */ }
    } else {
      mediaRecorderRef.current = null;
      stopAllTracks();
      setRecPhase("idle");
      setLocked(false);
      lockedRef.current = false;
      setHint("");
      setRecordSeconds(0);
    }
  }, []);

  const cancelRecording = useCallback(() => {
    stopRecording(true);
  }, [stopRecording]);

  /** Unlock recording: go back to holding so user can cancel by sliding or release. */
  const unlockRecording = useCallback(() => {
    if (recPhase !== "locked") return;
    lockedRef.current = false;
    setLocked(false);
    setRecPhase("holding");
    setHint("Slide left to cancel · tap lock to re-lock");
    setDragUI({ dx: 0, dy: 0 });
  }, [recPhase]);

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
      const wasStarted = Boolean(start?.started);
      const modeAtStart = start?.mode || mode;
      pressStartRef.current = null;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      // Short press (desktop + mobile): toggle voice ↔ video
      if (!wasStarted) {
        suppressModeToggleClickRef.current = true;
        const next = modeAtStart === "voice" ? "video" : "voice";
        setMediaMode(next);
        try { localStorage.setItem("messenger.mediaMode", next); } catch {}
        setTimeout(() => { suppressModeToggleClickRef.current = false; }, 0);
        return;
      }
      if (lockedRef.current) return;
      stopRecording(!!cancelRef.current);
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
      const wasStarted = Boolean(start?.started);
      const modeAtStart = start?.mode || mode;
      pressStartRef.current = null;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (!wasStarted) {
        suppressModeToggleClickRef.current = true;
        const next = modeAtStart === "voice" ? "video" : "voice";
        setMediaMode(next);
        try { localStorage.setItem("messenger.mediaMode", next); } catch {}
        setTimeout(() => { suppressModeToggleClickRef.current = false; }, 0);
        return;
      }
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


  const updateSuggestionsFromText = (value, cursor) => {
    const sc = getShortcodeAt(value, cursor);
    if (sc) {
      setScQuery(sc);
      setScIndex(0);
    } else {
      setScQuery(null);
      setScIndex(0);
    }

    const mention = getMentionAt(value, cursor);
    if (mention) {
      setMentionQuery(mention);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionIndex(0);
    }
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

  const applyMention = (user) => {
    if (!mentionQuery || !user?.username) return;
    const { start, end } = mentionQuery;
    const mention = `@${String(user.username).replace(/^@/, "")}`;
    const next = `${text.slice(0, start)}${mention} ${text.slice(end)}`;
    const nextCursor = start + mention.length + 1;
    setText(next);
    setMentionQuery(null);
    setMentionIndex(0);
    requestAnimationFrame(() => {
      const el = inputRef?.current;
      if (el && typeof el.setSelectionRange === "function") {
        try { el.setSelectionRange(nextCursor, nextCursor); } catch { /* */ }
        el.focus();
      }
    });
  };

  const onTextChange = (e) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setText(value);
    updateSuggestionsFromText(value, cursor);
  };

  const handleComposerKeyDown = (e) => {
    if (mentionMatches.length > 0 && mentionQuery) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setMentionIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const pick = mentionMatches[mentionIndex] || mentionMatches[0];
        if (pick) applyMention(pick);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setMentionQuery(null);
        setMentionIndex(0);
        return;
      }
    }

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

    // Formatting shortcuts (desktop + external keyboard on mobile)
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "e" && e.shiftKey) {
        e.preventDefault();
        applyTextFormat("codeblock");
        return;
      }
      if (key === "e") {
        e.preventDefault();
        applyTextFormat("code");
        return;
      }
      if (key === "s" && e.shiftKey) {
        e.preventDefault();
        applyTextFormat("spoiler");
        return;
      }
      if (key === "q" && e.shiftKey) {
        e.preventDefault();
        applyTextFormat("quote");
        return;
      }
      if (e.key === "`" || e.code === "Backquote") {
        e.preventDefault();
        applyTextFormat("code");
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


  const openFilePreview = async (f) => {
    if (!f) return;
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");
    const isTxt = f.type === "text/plain" || /\.(txt|md|csv|log)$/i.test(f.name || "");
    try {
      if (isPdf) {
        const url = URL.createObjectURL(f);
        setFilePreview({ name: f.name || "document.pdf", kind: "pdf", url });
      } else if (isTxt) {
        const textContent = await f.text();
        setFilePreview({
          name: f.name || "file.txt",
          kind: "txt",
          text: textContent.slice(0, 200000),
        });
      }
    } catch (e) {
      setRecordError(e?.message || "Could not preview file");
    }
  };

  const closeFilePreview = () => {
    setFilePreview((prev) => {
      if (prev?.url) {
        try { URL.revokeObjectURL(prev.url); } catch { /* */ }
      }
      return null;
    });
  };

  const getComposerTextarea = () => {
    const el = inputRef?.current;
    if (!el) return null;
    if (typeof el.selectionStart === "number") return el;
    return el.querySelector?.("textarea") || el;
  };

  const rememberSelection = (ta) => {
    if (!ta || typeof ta.selectionStart !== "number") return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    selectionRef.current = {
      start: Math.min(start, end),
      end: Math.max(start, end),
    };
  };

  /** Wrap current selection (or insert at cursor) with formatting markers. */
  const applyTextFormat = (kind) => {
    const ta = getComposerTextarea();
    const value = text || "";
    let start = selectionRef.current?.start ?? 0;
    let end = selectionRef.current?.end ?? 0;
    if (ta && typeof ta.selectionStart === "number") {
      // Live selection wins when focused; otherwise keep remembered range
      if (document.activeElement === ta || (ta.selectionStart !== ta.selectionEnd)) {
        start = Math.min(ta.selectionStart, ta.selectionEnd);
        end = Math.max(ta.selectionStart, ta.selectionEnd);
      }
    }
    if (fmtMenu && typeof fmtMenu.start === "number" && start === end && fmtMenu.start !== fmtMenu.end) {
      start = fmtMenu.start;
      end = fmtMenu.end ?? fmtMenu.start;
    }
    start = Math.max(0, Math.min(start, value.length));
    end = Math.max(start, Math.min(end, value.length));

    const selected = value.slice(start, end);
    let next;
    let selFrom;
    let selTo;
    if (kind === "spoiler") {
      const inner = selected || "text";
      next = value.slice(0, start) + "||" + inner + "||" + value.slice(end);
      selFrom = start + 2;
      selTo = selFrom + inner.length;
    } else if (kind === "code") {
      const inner = selected || "code";
      next = value.slice(0, start) + "`" + inner + "`" + value.slice(end);
      selFrom = start + 1;
      selTo = selFrom + inner.length;
    } else if (kind === "codeblock") {
      const inner = selected || "code";
      // Language sits right after opening fence; preview lets user edit it.
      next = value.slice(0, start) + "```\n" + inner + "\n```" + value.slice(end);
      // Place caret after ``` so user can type language (js, python, …)
      selFrom = start + 3;
      selTo = start + 3;
    } else if (kind === "quote") {
      const block = (selected || "quote").split("\n").map((l) => (l.startsWith("> ") ? l : ("> " + l))).join("\n");
      next = value.slice(0, start) + block + value.slice(end);
      selFrom = start;
      selTo = start + block.length;
    } else {
      setFmtMenu(null);
      return;
    }
    setText(next);
    setFmtMenu(null);
    selectionRef.current = { start: selFrom, end: selTo };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const node = getComposerTextarea();
          if (node) {
            node.focus();
            node.setSelectionRange(selFrom, selTo);
            rememberSelection(node);
          }
        } catch { /* */ }
      });
    });
  };

  const onTextContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ta = getComposerTextarea() || e.currentTarget?.querySelector?.("textarea") || e.currentTarget;
    rememberSelection(ta);
    const { start, end } = selectionRef.current;
    setFmtMenu({
      mouseX: e.clientX,
      mouseY: e.clientY,
      start,
      end,
    });
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
      <Box
        sx={{
          position: "relative",
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          p: 1.25,
          zIndex: 20,
        }}
      >
        {/* Video preview sits ABOVE the composer only (chat pane), not fullscreen */}
        {recKind === "video" && (
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              bottom: "100%",
              transform: "translateX(-50%)",
              mb: 1.5,
              zIndex: 25,
              pointerEvents: "auto",
            }}
          >
            <Box sx={{ position: "relative" }}>
              <Box
                sx={{
                  width: { xs: 168, sm: 200 },
                  height: { xs: 168, sm: 200 },
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "3px solid",
                  borderColor: showLock ? "warning.main" : "error.main",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.45), 0 0 0 4px rgba(0,0,0,0.25)",
                  bgcolor: "#000",
                }}
              >
                <Box
                  component="video"
                  ref={videoPreviewRef}
                  muted
                  playsInline
                  autoPlay
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    transform: cameraFacing === "user" ? "scaleX(-1)" : "none",
                  }}
                />
              </Box>
              <IconButton
                onClick={flipCamera}
                disabled={flippingCam}
                title={cameraFacing === "user" ? "Switch to rear camera" : "Switch to selfie"}
                sx={{
                  position: "absolute",
                  right: -4,
                  bottom: 8,
                  bgcolor: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.25)",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                  width: 36,
                  height: 36,
                }}
              >
                <CameraswitchIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>
          </Box>
        )}

        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={cancelRecording} title="Cancel" sx={{ color: "error.main" }}>
            <DeleteOutlineIcon />
          </IconButton>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              bgcolor: "action.hover",
              borderRadius: 3,
              px: 1.5,
              py: 0.85,
              transform: !showLock ? `translateX(${Math.min(0, dragUI.dx * 0.35)}px)` : "none",
              transition: showLock ? "transform 0.15s" : "none",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: "error.main",
                  flexShrink: 0,
                  animation: "pulse 1.2s infinite",
                  "@keyframes pulse": {
                    "0%": { opacity: 1 },
                    "50%": { opacity: 0.35 },
                    "100%": { opacity: 1 },
                  },
                }}
              />
              <Typography variant="body2" fontWeight={700} noWrap sx={{ fontVariantNumeric: "tabular-nums" }}>
                {formatRecTime(recordSeconds)}
              </Typography>
              {showLock ? (
                <LockOutlinedIcon sx={{ fontSize: 16, color: "warning.main" }} />
              ) : (
                <LockOpenOutlinedIcon sx={{ fontSize: 16, color: "text.secondary", opacity: 0.7 }} />
              )}
              <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                {showLock
                  ? "Locked · finish when ready"
                  : (hint || (recKind === "video" ? "Slide up / lock · left cancel" : "Slide up to lock · left cancel"))}
              </Typography>
            </Stack>
            <Box
              sx={{
                mt: 0.6,
                width: "100%",
                height: 5,
                borderRadius: 3,
                bgcolor: "action.selected",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.min(100, Math.round(micLevel * 100))}%`,
                  bgcolor: micLevel > 0.85 ? "error.main" : micLevel > 0.55 ? "warning.main" : "success.main",
                  transition: "width 0.04s linear",
                }}
              />
            </Box>
          </Box>

          {!showLock && (
            <IconButton
              onClick={() => {
                lockedRef.current = true;
                setLocked(true);
                setRecPhase("locked");
                setHint("Locked · finish when ready");
                setDragUI({ dx: 0, dy: 0 });
              }}
              title="Lock recording"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: 0.55 + Math.min(0.45, Math.max(0, -dragUI.dy) / 40),
                transform: `translateY(${Math.max(LOCK_DY, Math.min(0, dragUI.dy)) * 0.3}px)`,
                borderRadius: 2,
                px: 0.75,
              }}
            >
              <KeyboardArrowUpIcon fontSize="small" color="action" />
              <LockOutlinedIcon sx={{ fontSize: 20 }} color="action" />
            </IconButton>
          )}

          {showLock && (
            <IconButton
              onClick={unlockRecording}
              title="Unlock"
              sx={{
                bgcolor: "action.hover",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <LockOpenOutlinedIcon />
            </IconButton>
          )}

          {/* Red finish / stop recording — always visible while recording */}
          <IconButton
            onClick={() => stopRecording(false)}
            title="Finish & send"
            sx={{
              width: 48,
              height: 48,
              bgcolor: "error.main",
              color: "#fff",
              boxShadow: "0 4px 14px rgba(211,47,47,0.45)",
              "&:hover": { bgcolor: "error.dark" },
              flexShrink: 0,
            }}
          >
            <StopCircleIcon sx={{ fontSize: 28 }} />
          </IconButton>
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
      {/* @mention island — same interaction model as emoji shortcode suggestions */}
      {mentionQuery && mentionMatches.length > 0 && (
        <Box
          sx={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: "100%",
            mb: 0.75,
            zIndex: 31,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.25,
            boxShadow: 6,
            overflow: "hidden",
          }}
        >
          <List dense disablePadding sx={{ maxHeight: { xs: 260, sm: 300 }, overflowY: "auto" }}>
            {mentionMatches.map((u, i) => {
              const rawAvatar = u.avatar || u.avatar_url || u.user?.avatar || u.user?.avatar_url || "";
              const avatarSrc = rawAvatar ? withTokenQuery(rawAvatar) : undefined;
              return (
              <ListItemButton
                key={`${u.id || u.username}-${i}`}
                selected={i === mentionIndex}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  applyMention(u);
                }}
                sx={{
                  py: 0.85, px: 1.25, gap: 0.5, borderRadius: 0,
                  "&.Mui-selected": {
                    bgcolor: (t) => t.palette.mode === "dark" ? "rgba(25,118,210,0.18)" : "rgba(25,118,210,0.1)",
                  },
                }}
              >
                <ListItemAvatar sx={{ minWidth: 44, mr: 0.5 }}>
                  <Avatar
                    src={avatarSrc || undefined}
                    imgProps={{ referrerPolicy: "no-referrer" }}
                    sx={{ width: 34, height: 34, fontSize: 14, flexShrink: 0 }}
                  >
                    {(u.username || "U")[0]?.toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={`@${u.username}`}
                  secondary={u.label && u.label !== u.username ? u.label : (u.display_name && u.display_name !== u.username ? u.display_name : undefined)}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: i === mentionIndex ? 600 : 500, noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true, fontSize: 12 }}
                />
              </ListItemButton>
              );
            })}
          </List>
        </Box>
      )}

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
          <Stack direction="row" spacing={1.25} sx={{ width: "max-content", pr: 1, pt: 0.75, pb: 0.25 }}>
            {files.map((f, i) => {
              const url = thumbUrl(f);
              const isImg = f.type?.startsWith("image/");
              const isVid = f.type?.startsWith("video/");
              const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");
              const isTxt = f.type === "text/plain" || /\.(txt|md|csv|log)$/i.test(f.name || "");
              const canPreview = isImg || isVid || isPdf || isTxt;
              return (
                <Box
                  key={`${f.name}-${f.size}-${i}`}
                  sx={{
                    position: "relative",
                    width: 72, height: 72, flexShrink: 0,
                    // overflow visible so the close button is not clipped
                    overflow: "visible",
                    userSelect: "none",
                  }}
                >
                  <Box
                    onClick={() => {
                      if ((isImg || isVid) && onEditAttachment) onEditAttachment(f, i);
                      else if (isPdf || isTxt) openFilePreview(f);
                    }}
                    sx={{
                      width: "100%", height: "100%",
                      borderRadius: 2,
                      overflow: "hidden",
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "action.hover",
                      cursor: canPreview ? "pointer" : "default",
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
                      <Box sx={{
                        width: "100%", height: "100%", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 0.25, px: 0.5,
                      }}>
                        {f.name?.startsWith("voice_") ? <MicIcon />
                          : f.name?.startsWith("video_message_") ? <VideocamIcon />
                          : isPdf ? <PictureAsPdfIcon color="error" />
                          : isTxt ? <DescriptionIcon color="primary" />
                          : <AttachFileIcon />}
                        <Typography variant="caption" noWrap sx={{ maxWidth: "100%", fontSize: 9, lineHeight: 1.1, opacity: 0.8 }}>
                          {(f.name || "file").length > 10 ? `${(f.name || "").slice(0, 8)}…` : (f.name || "file")}
                        </Typography>
                      </Box>
                    )}
                    {isVid && (
                      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.25)", pointerEvents: "none", borderRadius: 2 }}>
                        <VideocamIcon sx={{ color: "#fff", fontSize: 22 }} />
                      </Box>
                    )}
                  </Box>
                  {/* Close sits ABOVE the tile, not clipped by overflow */}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles((prev) => prev.filter((_, j) => j !== i));
                    }}
                    sx={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      width: 24,
                      height: 24,
                      p: 0,
                      zIndex: 2,
                      bgcolor: "error.main",
                      color: "#fff",
                      boxShadow: 2,
                      border: "2px solid",
                      borderColor: "background.paper",
                      "&:hover": { bgcolor: "error.dark" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              );
            })}
          </Stack>
          </Box>
        </Box>
      )}




      {/* Multi-file code workspace + quote editors */}
      {(() => {
        const blocks = extractComposeBlocks(text);
        const codeBlocks = blocks.filter((b) => b.type === "codeblock");
        const quoteBlocks = blocks.filter((b) => b.type === "quote");
        if (!codeBlocks.length && !quoteBlocks.length) return null;
        const split = splitMarkdownCode(text);
        return (
          <Box
            sx={{
              px: 1.25,
              pt: 1,
              pb: 0.75,
              borderTop: files.length ? "none" : "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.85, fontWeight: 700 }}>
              Editors
            </Typography>
            <Stack spacing={1.25}>
              {codeBlocks.length > 0 && (
                <ComposeCodeWorkspace
                  files={split.files}
                  onChangeFiles={(nextFiles) => {
                    setText(joinMarkdownCode(split.prefix, nextFiles, split.suffix));
                  }}
                  onAttachFile={(file) => {
                    setFiles((prev) => [...prev, file]);
                  }}
                  onRemoveAll={() => {
                    setText([split.prefix, split.suffix].filter(Boolean).join("\n\n"));
                  }}
                />
              )}
              {quoteBlocks.map((b) => (
                <ComposeQuoteEditor
                  key={`q-${b.start}`}
                  text={b.text}
                  onChange={(q) => setText(replaceQuoteBlock(text, b.start, b.end, q))}
                  onRemove={() => setText((text || "").slice(0, b.start) + (text || "").slice(b.end))}
                />
              ))}
            </Stack>
          </Box>
        );
      })()}

      <Stack direction="row" alignItems="center" spacing={isMobile ? 0.15 : 0.5}
        sx={{
          p: isMobile ? 0.75 : 1,
          bgcolor: "background.paper",
          borderTop: files.length ? "none" : "1px solid",
          borderColor: "divider",
        }}>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept={attachAccept}
          {...(attachCapture ? { capture: attachCapture } : {})}
          onChange={(e) => {
            handleFileChange(e);
            setAttachCapture(undefined);
          }}
        />
        {!editingMsg && (
          <>
            <Tooltip title="Attach">
              <IconButton
                onClick={() => setAttachMenuAnchor((v) => (v ? null : true))}
                size="small"
                sx={{
                  p: isMobile ? 0.5 : 1,
                  mr: isMobile ? -0.25 : 0,
                  alignSelf: "center",
                  bgcolor: attachMenuAnchor ? (t) => alpha(t.palette.primary.main, 0.15) : "transparent",
                }}
              >
                <AttachFileIcon sx={{ fontSize: isMobile ? 20 : 24 }} />
              </IconButton>
            </Tooltip>

            {/* Curved attach island — circular action buttons */}
            {Boolean(attachMenuAnchor) && (
              <Box
                onClick={() => setAttachMenuAnchor(null)}
                sx={{ position: "fixed", inset: 0, zIndex: 35, bgcolor: "transparent" }}
              />
            )}
            {Boolean(attachMenuAnchor) && (
              <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                  position: "absolute",
                  left: 8,
                  right: 8,
                  bottom: "100%",
                  mb: 1,
                  zIndex: 40,
                  display: "flex",
                  justifyContent: "center",
                  pointerEvents: "auto",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: { xs: 1, sm: 1.5 },
                    px: { xs: 1.5, sm: 2.25 },
                    py: 1.25,
                    borderRadius: 999,
                    bgcolor: (t) => alpha(t.palette.background.paper, 0.92),
                    backdropFilter: "blur(16px)",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08)",
                  }}
                >
                  {[
                    {
                      key: "photo",
                      label: "Photos",
                      icon: <ImageIcon />,
                      color: "#42a5f5",
                      accept: "image/*,image/gif,.gif,.jpg,.jpeg,.png,.webp,.heic",
                      capture: undefined,
                    },
                    {
                      key: "video",
                      label: "Videos",
                      icon: <MovieIcon />,
                      color: "#ab47bc",
                      accept: "video/*,.mp4,.webm,.mov,.mkv",
                      capture: undefined,
                    },
                    {
                      key: "audio",
                      label: "Audio",
                      icon: <AudioFileIcon />,
                      color: "#26a69a",
                      accept: "audio/*,.mp3,.ogg,.wav,.m4a,.aac,.flac",
                      capture: undefined,
                    },
                    {
                      key: "doc",
                      label: "Files",
                      icon: <InsertDriveFileIcon />,
                      color: "#78909c",
                      accept: ".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.csv,.md,.json",
                      capture: undefined,
                    },
                    {
                      key: "all",
                      label: "All",
                      icon: <AttachFileIcon />,
                      color: "#5c6bc0",
                      accept: "image/*,image/gif,.gif,video/*,audio/*,.pdf,.txt,.zip,.doc,.docx,.md,.csv,*/*",
                      capture: undefined,
                    },
                    ...(isMobile
                      ? [
                          {
                            key: "cam",
                            label: "Camera",
                            icon: <PhotoCameraIcon />,
                            color: "#ef5350",
                            accept: "image/*",
                            capture: "environment",
                          },
                        ]
                      : []),
                  ].map((item) => (
                    <Tooltip key={item.key} title={item.label} arrow>
                      <Box
                        component="button"
                        type="button"
                        onClick={() => {
                          setAttachMenuAnchor(null);
                          setAttachAccept(item.accept);
                          setAttachCapture(item.capture);
                          requestAnimationFrame(() => fileRef.current?.click());
                        }}
                        sx={{
                          width: { xs: 48, sm: 54 },
                          height: { xs: 48, sm: 54 },
                          borderRadius: "50%",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: alpha(item.color, 0.16),
                          color: item.color,
                          transition: "transform 0.15s, background 0.15s, box-shadow 0.15s",
                          boxShadow: `0 4px 14px ${alpha(item.color, 0.25)}`,
                          "&:hover": {
                            transform: "translateY(-3px) scale(1.05)",
                            bgcolor: alpha(item.color, 0.28),
                            boxShadow: `0 8px 20px ${alpha(item.color, 0.35)}`,
                          },
                          "&:active": { transform: "scale(0.96)" },
                          "& .MuiSvgIcon-root": { fontSize: { xs: 22, sm: 24 } },
                        }}
                      >
                        {item.icon}
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            )}
          </>
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
          onContextMenu={onTextContextMenu}
          value={text}
          onChange={(e) => {
            onTextChange(e);
            rememberSelection(e.target);
          }}
          onKeyDown={handleComposerKeyDown}
          onKeyUp={(e) => rememberSelection(e.target)}
          onSelect={(e) => {
            // Single selection tracker only (avoid double-handling with onClick)
            const el = e.target;
            rememberSelection(el);
            updateSuggestionsFromText(el.value, el.selectionStart);
          }}
          onMouseUp={(e) => rememberSelection(e.target)}
          onTouchEnd={(e) => {
            // mobile: selection often finalizes after touchend
            const el = e.target;
            setTimeout(() => rememberSelection(el), 0);
          }}
          onBlur={(e) => {
            // Keep last range so format buttons still wrap the right text
            rememberSelection(e.target);
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              bgcolor: "action.hover",
              alignItems: "center",
              py: isMobile ? 0.35 : 0.5,
            },
            "& textarea": {
              lineHeight: 1.4,
              userSelect: "text",
              WebkitUserSelect: "text",
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

      {/* Text formatting context menu */}
      <Menu
        open={Boolean(fmtMenu)}
        onClose={() => setFmtMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={fmtMenu ? { top: fmtMenu.mouseY, left: fmtMenu.mouseX } : undefined}
        slotProps={{ paper: { sx: { minWidth: 180 } } }}
      >
        <MenuItem onClick={() => applyTextFormat("spoiler")}>
          <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
          Spoiler
          <Typography variant="caption" sx={{ ml: "auto", pl: 2, opacity: 0.55 }}>Ctrl+Shift+S</Typography>
        </MenuItem>
        <MenuItem onClick={() => applyTextFormat("code")}>
          <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>
          Inline code
          <Typography variant="caption" sx={{ ml: "auto", pl: 2, opacity: 0.55 }}>Ctrl+E</Typography>
        </MenuItem>
        <MenuItem onClick={() => applyTextFormat("codeblock")}>
          <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>
          Code block
          <Typography variant="caption" sx={{ ml: "auto", pl: 2, opacity: 0.55 }}>Ctrl+Shift+E</Typography>
        </MenuItem>
        <MenuItem onClick={() => applyTextFormat("quote")}>
          <ListItemIcon><FormatQuoteIcon fontSize="small" /></ListItemIcon>
          Quote
          <Typography variant="caption" sx={{ ml: "auto", pl: 2, opacity: 0.55 }}>Ctrl+Shift+Q</Typography>
        </MenuItem>
      </Menu>

      {/* PDF / TXT preview for pending files */}
      <Dialog open={Boolean(filePreview)} onClose={closeFilePreview} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {filePreview?.name || "Preview"}
          <IconButton onClick={closeFilePreview} size="small" sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, minHeight: 320, bgcolor: "background.default" }}>
          {filePreview?.kind === "pdf" && filePreview.url && (
            <Box
              component="iframe"
              src={filePreview.url}
              title={filePreview.name}
              sx={{ width: "100%", height: { xs: 360, sm: 520 }, border: 0, display: "block" }}
            />
          )}
          {filePreview?.kind === "txt" && (
            <Box
              component="pre"
              sx={{
                m: 0, p: 2,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 13,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: { xs: 360, sm: 520 },
                overflow: "auto",
              }}
            >
              {filePreview.text}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeFilePreview} sx={{ textTransform: "none" }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Stack, Typography, IconButton, Slider, MenuItem, Select, FormControl,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CloseIcon from "@mui/icons-material/Close";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";

import { formatDuration, withTokenQuery } from "../messengerUtils";

/**
 * Top audio player bar (Telegram-style). Renders a fixed bar at the top of the
 * chat pane when audioPlayer state is non-null.
 *
 * Persisted across chat switches: lives in MessengerApp, not in MessageBubble.
 * When the user opens another chat, the audio keeps playing and the bar stays.
 * Only the explicit close button (or end-of-track) clears it.
 *
 * Props:
 *  - player: { att, title } | null  — the currently-loaded audio attachment
 *  - onChange: (player) => void     — update parent state (e.g. to clear)
 */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function AudioPlayerBar({ player, onChange }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  // Load new source when `player` changes
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!player) {
      a.pause();
      a.removeAttribute("src");
      return;
    }
    const nextSrc = withTokenQuery(player.att.url);
    if (a.src !== nextSrc) {
      a.src = nextSrc;
      a.currentTime = 0;
      setCurrentTime(0);
      a.playbackRate = speed;
      a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply playback rate
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      a.pause();
      setIsPlaying(false);
    }
  }, []);

  const onSeek = (_, value) => {
    const a = audioRef.current;
    if (!a || !isFinite(value)) return;
    a.currentTime = value;
    setCurrentTime(value);
  };

  const onClosePlayer = () => {
    const a = audioRef.current;
    if (a) { a.pause(); a.removeAttribute("src"); }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    onChange(null);
  };

  if (!player) return null;
  const title = player.title || player.att?.original_filename || "Audio";

  return (
    <Box
      sx={{
        position: "absolute",
        top: 56, // sits below the chat header
        left: 0,
        right: 0,
        zIndex: 10,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        px: 1.5,
        py: 0.75,
        boxShadow: 1,
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        preload="metadata"
      />
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={togglePlay} color="primary" size="small">
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        {player.att?.kind === "voice" || (player.att?.original_filename || "").startsWith("voice_")
          ? <GraphicEqIcon color="action" fontSize="small" />
          : <MusicNoteIcon color="action" fontSize="small" />}
        <Typography
          variant="caption"
          noWrap
          sx={{ maxWidth: 200, fontWeight: 600 }}
        >
          {title}
        </Typography>
        <Slider
          value={currentTime}
          max={duration || 1}
          min={0}
          step={0.1}
          onChange={onSeek}
          size="small"
          sx={{ flex: 1, minWidth: 80 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 64 }}>
          <Select
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            sx={{ height: 28, "& .MuiSelect-select": { py: 0.3, px: 1, fontSize: 12 } }}
            renderValue={(v) => `${v}×`}
          >
            {SPEEDS.map((s) => (
              <MenuItem key={s} value={s} dense>{`${s}× speed`}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <IconButton onClick={onClosePlayer} size="small" title="Stop & close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}

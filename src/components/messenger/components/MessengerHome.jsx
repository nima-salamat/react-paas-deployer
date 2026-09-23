import React from "react";
import {
  Box, Typography, Button, Stack, Paper,
} from "@mui/material";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

export default function MessengerHome({
  onNewMessage,
  onCreateGroup,
  onNavigateHome,
  chatCount = 0,
}) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 4,
        overflow: "auto",
        background: (theme) => (
          theme.palette.mode === "dark"
            ? "radial-gradient(circle at 50% 10%, rgba(92,112,255,0.14), transparent 42%)"
            : "radial-gradient(circle at 50% 10%, rgba(25,118,210,0.09), transparent 42%)"
        ),
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "min(560px, 100%)",
          px: { xs: 2.5, sm: 5 },
          py: { xs: 3, sm: 5 },
          borderRadius: { xs: 3, sm: 5 },
          textAlign: "center",
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? "0 24px 80px rgba(0,0,0,0.22)"
              : "0 24px 80px rgba(15,23,42,0.08)",
        }}
      >
        <Box
          sx={{
            width: 76,
            height: 76,
            mx: "auto",
            mb: 2.25,
            borderRadius: "24px",
            display: "grid",
            placeItems: "center",
            color: "primary.main",
            bgcolor: (theme) => (
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.07)"
                : "rgba(25,118,210,0.08)"
            ),
          }}
        >
          <ChatBubbleRoundedIcon sx={{ fontSize: 38 }} />
        </Box>

        <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: -0.3 }}>
          Your conversations
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 1, maxWidth: 430, mx: "auto", lineHeight: 1.65 }}
        >
          {chatCount
            ? "Pick up a conversation, search for someone, or start something new."
            : "Start a conversation and keep your messages, calls, files, and groups in one place."}
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="center"
          sx={{ mt: 3 }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<SearchRoundedIcon />}
            onClick={onNewMessage}
            sx={{ minHeight: 46, borderRadius: 2.5, px: 2.5 }}
          >
            New message
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<GroupAddRoundedIcon />}
            onClick={onCreateGroup}
            sx={{ minHeight: 46, borderRadius: 2.5, px: 2.5 }}
          >
            New group
          </Button>
        </Stack>

        <Button
          size="small"
          startIcon={<HomeOutlinedIcon fontSize="small" />}
          onClick={onNavigateHome}
          sx={{ mt: 2.5, color: "text.secondary" }}
        >
          Back to Deployer
        </Button>
      </Paper>
    </Box>
  );
}

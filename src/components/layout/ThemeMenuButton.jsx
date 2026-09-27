import React, { useState } from "react";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import SettingsBrightnessOutlinedIcon from "@mui/icons-material/SettingsBrightnessOutlined";

const THEME_CHOICES = [
  { value: "light", label: "Light", icon: LightModeOutlinedIcon },
  { value: "dark", label: "Dark", icon: DarkModeOutlinedIcon },
  { value: "system", label: "System", icon: SettingsBrightnessOutlinedIcon },
];

export default function ThemeMenuButton({
  themeMode = "system",
  onThemeModeChange,
  tooltip = "Change theme",
  buttonSx = {},
  menuSx = {},
}) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const current =
    THEME_CHOICES.find((choice) => choice.value === themeMode) ||
    THEME_CHOICES.find((choice) => choice.value === "system");
  const CurrentIcon = current.icon;

  const handleChange = (nextMode) => {
    setAnchorEl(null);
    if (!nextMode || nextMode === themeMode) return;
    onThemeModeChange?.(nextMode);
  };

  return (
    <>
      <Tooltip title={tooltip}>
        <IconButton
          size="small"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label={tooltip}
          aria-haspopup="menu"
          aria-expanded={anchorEl ? "true" : undefined}
          sx={{
            width: { xs: 36, sm: 38 },
            height: { xs: 36, sm: 38 },
            border: "1px solid",
            borderColor: alpha(theme.palette.divider, 0.95),
            color: "text.secondary",
            bgcolor: alpha(theme.palette.background.paper, 0.55),
            "&:hover": {
              bgcolor: alpha(
                theme.palette.text.primary,
                theme.palette.mode === "dark" ? 0.07 : 0.035
              ),
              color: "text.primary",
            },
            ...buttonSx,
          }}
        >
          <CurrentIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              minWidth: 160,
              borderRadius: 1.75,
              ...menuSx,
            },
          },
        }}
      >
        {THEME_CHOICES.map((choice) => {
          const ChoiceIcon = choice.icon;
          const selected = choice.value === themeMode;
          return (
            <MenuItem
              key={choice.value}
              selected={selected}
              onClick={() => handleChange(choice.value)}
            >
              <ListItemIcon>
                <ChoiceIcon
                  fontSize="small"
                  color={selected ? "primary" : undefined}
                />
              </ListItemIcon>
              <ListItemText
                primary={choice.label}
                primaryTypographyProps={{ fontWeight: selected ? 800 : 500 }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

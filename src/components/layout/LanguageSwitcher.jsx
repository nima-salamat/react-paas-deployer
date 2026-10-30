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
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import { useTheme } from "@mui/material/styles";
import { useLocale } from "../../i18n/LocaleProvider.jsx";

export default function LanguageSwitcher({ buttonSx = {}, menuSx = {} }) {
  const theme = useTheme();
  const { language, languageOptions, setLanguage, t } = useLocale();
  const [anchorEl, setAnchorEl] = useState(null);

  const selectLanguage = (code) => {
    setAnchorEl(null);
    if (code !== language) setLanguage(code);
  };

  return (
    <>
      <Tooltip title={t("Interface language")}>
        <IconButton
          size="small"
          aria-label={t("Interface language")}
          aria-haspopup="menu"
          aria-expanded={anchorEl ? "true" : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            width: { xs: 36, sm: 38 },
            height: { xs: 36, sm: 38 },
            border: "1px solid",
            borderColor: alpha(theme.palette.divider, 0.95),
            color: "text.secondary",
            bgcolor: alpha(theme.palette.background.paper, 0.55),
            "&:hover": { color: "text.primary" },
            ...buttonSx,
          }}
        >
          <TranslateOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 0.75, minWidth: 170, borderRadius: 1.75, ...menuSx } } }}
      >
        {languageOptions.map((option) => {
          const selected = option.code === language;
          return (
            <MenuItem key={option.code} selected={selected} onClick={() => selectLanguage(option.code)}>
              <ListItemIcon sx={{ minWidth: 34, fontSize: 13, fontWeight: 800 }}>
                {option.code === "fa" ? "فا" : "EN"}
              </ListItemIcon>
              <ListItemText
                primary={option.nativeLabel}
                secondary={option.label}
                primaryTypographyProps={{ fontWeight: selected ? 800 : 500 }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

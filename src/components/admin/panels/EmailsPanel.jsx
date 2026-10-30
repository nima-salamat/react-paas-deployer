import React from "react";
import TranslatedTextTree from "../../../i18n/TranslatedTextTree.jsx";
import { Box, Typography, Stack } from "@mui/material";
import EmailManagement from "../../emails/EmailManagement.jsx";
import PermissionGate from "../components/PermissionGate";

/**
 * EmailsPanel — thin wrapper around the existing EmailManagement component.
 * Gates access on the emails.manage rule.
 */
export default function EmailsPanel() {
  return (
    <TranslatedTextTree>
    <PermissionGate rule="emails.manage">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Email</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage templates and review delivery logs.
          </Typography>
        </Box>
        <EmailManagement />
      </Stack>
    </PermissionGate>
    </TranslatedTextTree>
  );
}

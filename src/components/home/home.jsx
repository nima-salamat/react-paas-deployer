import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Paper,
  Avatar,
  Grid,
  Divider,
  useTheme,
  IconButton,
} from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import StorageIcon from "@mui/icons-material/Storage";

export default function Home() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [hasPlan, setHasPlan] = useState(false);

  const cardBg = theme.palette.mode === "dark" ? "linear-gradient(180deg,#0b1220,#071227)" : "linear-gradient(180deg,#ffffff,#f5f9ff)";
  const subtleBorder = theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(16,24,40,0.04)";

  return (
    <Box sx={{ minHeight: "100vh", py: { xs: 4, md: 8 }, px: { xs: 2, md: 4 }, background: theme.palette.mode === 'dark' ? 'linear-gradient(180deg,#071020,#081427)' : 'linear-gradient(180deg,#f7fbff,#eef7ff)', color: 'text.primary', transition: 'background 200ms linear' }}>
      <Container maxWidth="lg">
        {/* header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>PaaS Deployer</Typography>
            <Typography variant="body2" color="text.secondary">Create plans → deploy services → monitor and manage</Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => navigate('/docs')} sx={{ borderColor: subtleBorder }}>Docs</Button>

            <Button
              startIcon={<RocketLaunchIcon />}
              variant="contained"
              onClick={() => { setHasPlan(true); navigate('/plans'); }}
              sx={{
                background: theme.palette.mode === 'dark' ? 'linear-gradient(90deg,#0f1724,#0b2540)' : 'linear-gradient(90deg,#4f46e5,#06b6d4)',
                color: '#fff',
                px: 2.5,
                py: 1,
                fontWeight: 700,
                boxShadow: theme.palette.mode === 'dark' ? '0 6px 18px rgba(2,6,23,0.6)' : '0 10px 30px rgba(99,102,241,0.12)',
                '&:hover': { transform: 'translateY(-1px)' },
                transition: 'transform 160ms ease, box-shadow 160ms ease'
              }}
            >
              Create / Choose Plan
            </Button>
          </Stack>
        </Box>

        {/* banner */}
        {!hasPlan && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Paper elevation={3} sx={{ p: 2, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2, background: cardBg, border: `1px solid ${subtleBorder}` }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: 'info.light', width: 56, height: 56 }}>
                  <AccountTreeIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Start with a Plan</Typography>
                  <Typography variant="body2" color="text.secondary">Plans define CPU, RAM, storage & pricing — choose or create a plan to get started.</Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => { setHasPlan(true); navigate('/plans'); }} sx={{ px: 2 }}>Choose / Create Plan</Button>
              </Stack>
            </Paper>
          </motion.div>
        )}

        {/* Quickstart */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Quickstart</Typography>
            <Stack direction="row" spacing={1}>
              <Typography variant="caption" color="text.secondary">Get up and running in three easy steps</Typography>
            </Stack>
          </Box>

          <Grid container spacing={2}>
            {[{
              title: 'Choose a Plan',
              desc: 'Define resource limits & pricing for your deployments.',
              icon: <AccountTreeIcon />
            },{
              title: 'Create a Service',
              desc: 'Create a service from the plan template and customize resources.',
              icon: <StorageIcon />
            },{
              title: 'Deploy & Manage',
              desc: 'Start, stop and monitor your deployments with easy controls.',
              icon: <RocketLaunchIcon />
            }].map((c, i) => (
              <Grid item xs={12} sm={4} key={c.title}>
                <motion.div whileHover={{ y: -6 }} style={{ height: '100%' }}>
                  <Paper elevation={4} sx={{ p: 2.5, height: '100%', borderRadius: 2, display: 'flex', gap: 2, alignItems: 'flex-start', background: cardBg, border: `1px solid ${subtleBorder}`, '&:hover': { boxShadow: theme.palette.mode === 'dark' ? '0 10px 30px rgba(2,6,23,0.6)' : '0 12px 40px rgba(16,24,40,0.06)' } }}>
                    <Avatar sx={{ bgcolor: (i===0? 'primary.light' : i===1? 'success.light' : 'warning.light'), width: 48, height: 48 }}>
                      {c.icon}
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontWeight: 800 }}>{c.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{c.desc}</Typography>
                    </Box>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* footer CTA */}
        <Paper elevation={3} sx={{ p: 3, borderRadius: 2, background: cardBg, border: `1px solid ${subtleBorder}` }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Need help?</Typography>
              <Typography variant="body2" color="text.secondary">Recommended: 1) choose or create a plan, 2) create a service using that plan, 3) deploy & monitor. See the docs for detailed guides.</Typography>
            </Grid>

            <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => navigate('/plans')} sx={{ borderColor: subtleBorder }}>Plans</Button>
                <Button variant="contained" onClick={() => navigate('/services')} sx={{ background: theme.palette.mode === 'dark' ? 'linear-gradient(90deg,#0f1724,#0b2540)' : 'linear-gradient(90deg,#4f46e5,#06b6d4)', color: '#fff' }}>Manage Services</Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
}

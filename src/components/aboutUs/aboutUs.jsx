import React, { useState } from "react";
import {
  Box,
  Typography,
  Container,
  keyframes,
} from "@mui/material";
import Rocket from "../../assets/aboutUs/rocket.svg";

/* Float (always active on inner wrapper) */
const float = keyframes`
  0% { transform: translateY(0px) rotate(-2deg); }
  50% { transform: translateY(-10px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(-2deg); }
`;

/* Launch up */
const launchUp = keyframes`
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-130vh); opacity: 0; }
`;

/* Return from bottom */
const returnFromBottom = keyframes`
  0% { transform: translateY(130vh); opacity: 0; }
  80% { transform: translateY(-8px); opacity: 1; }
  100% { transform: translateY(0); opacity: 1; }
`;

/* Flame */
const flameFlicker = keyframes`
  0% { transform: scaleY(1); opacity: 1; }
  50% { transform: scaleY(1.4); opacity: 0.85; }
  100% { transform: scaleY(1); opacity: 1; }
`;

const AboutUs = () => {
  const [status, setStatus] = useState("idle"); 
  // idle | launching | returning

  const handleClick = () => {
    if (status !== "idle") return;

    setStatus("launching");

    setTimeout(() => {
      setStatus("returning");

      setTimeout(() => {
        setStatus("idle");
      }, 1600);
    }, 1000);
  };

  const getOuterAnimation = () => {
    if (status === "launching")
      return `${launchUp} 1s ease-in forwards`;
    if (status === "returning")
      return `${returnFromBottom} 1.6s cubic-bezier(.22,1,.36,1)`;
    return "none";
  };

  return (
    <Box
      sx={{
        py: 10,
        minHeight: "85vh",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* 🚀 Rocket */}
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            {/* OUTER wrapper → controls launch/return */}
            <Box
              onClick={handleClick}
              sx={{
                position: "relative",
                width: { xs: 170, md: 240 },
                animation: getOuterAnimation(),
                cursor: "pointer",

                "&:hover .hoverText": {
                  opacity: status === "idle" ? 1 : 0,
                  transform:
                    status === "idle"
                      ? "translateY(-10px)"
                      : "translateY(0)",
                },
              }}
            >
              {/* INNER wrapper → float always active */}
              <Box
                sx={{
                  animation:
                    status === "idle"
                      ? `${float} 5s ease-in-out infinite`
                      : "none",
                }}
              >
                <Typography
                  className="hoverText"
                  variant="body2"
                  sx={{
                    position: "absolute",
                    top: -30,
                    left: "50%",
                    transform: "translateX(-50%)",
                    opacity: 0,
                    transition: "all 0.3s ease",
                    fontWeight: 600,
                  }}
                >
                  Click the rocket 🚀
                </Typography>

                <Box
                  component="img"
                  src={Rocket}
                  alt="Rocket"
                  sx={{
                    width: "100%",
                    display: "block",
                  }}
                />

                {/* Flame always active */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: "-8px",
                    left: 0,
                    right: 0,
                    margin: "0 auto",
                    width: 24,
                    height: 50,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, #fff176 20%, #ff9800 55%, #ff3d00 100%)",
                    animation: `${flameFlicker} 0.3s infinite`,
                    filter: "blur(1.5px)",
                    boxShadow: "0 0 25px rgba(255,120,0,0.6)",
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* 🧠 Text */}
          <Box>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              PaaS Deployer
            </Typography>

            <Typography variant="body1" color="text.secondary">
              This is a simple deployment application.
              It takes your code, runs it ,
              and keeps it stable. Nothing more, nothing less.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default AboutUs;

import React from "react";

import { ProfileProvider } from "./components/profile/profile.jsx";
import App from "./App.jsx";
import CustomCursor from "./components/layout/CustomCursor.jsx";

export default function Root() {
  return (
    <ProfileProvider>
      <CustomCursor />
      <App />
    </ProfileProvider>
  );
}

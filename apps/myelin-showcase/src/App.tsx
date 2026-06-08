import { Route, Switch } from "wouter";
import { AppLayout } from "./components/AppLayout.js";
import { LandingPage } from "./pages/LandingPage.js";
import { DemoPage } from "./pages/DemoPage.js";
import { ThemesPage } from "./pages/ThemesPage.js";

export default function App() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/">
          <LandingPage />
        </Route>
        <Route path="/demo">
          <DemoPage />
        </Route>
        <Route path="/themes">
          <ThemesPage />
        </Route>
      </Switch>
    </AppLayout>
  );
}

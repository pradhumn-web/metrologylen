import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Scanner from "./pages/Scanner";
import { HealthPage, RulesPage, VerdictsPage } from "./pages/InspectionPages";
import { HistoryPage, ModesPage } from "./pages/WorkspacePages";
import Assistant from "./pages/Assistant";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Landing} />
      <Route path={"/scan"} component={Scanner} />
      <Route path={"/rules"} component={RulesPage} />
      <Route path={"/verdicts"} component={VerdictsPage} />
      <Route path={"/health"} component={HealthPage} />
      <Route path={"/history"} component={HistoryPage} />
      <Route path={"/modes"} component={ModesPage} />
      <Route path={"/assistant"} component={Assistant} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

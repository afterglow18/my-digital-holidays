import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppLayout } from './components/layout/AppLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
      <h1 className="text-6xl font-display font-bold text-primary drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">404</h1>
      <p className="text-xl font-bold uppercase">As if! This page is totally lost.</p>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={WardrobePage} />
        <Route path="/generate" component={GeneratePage} />
        <Route path="/saved" component={SavedPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;

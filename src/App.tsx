import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { MissionControl } from './modules/missionControl/MissionControl';
import { Inbox } from './modules/inbox/Inbox';
import { Ideas } from './modules/ideas/Ideas';
import { Ventures } from './modules/ventures/Ventures';
import { Goals } from './modules/goals/Goals';
import { Tasks } from './modules/tasks/Tasks';
import { Resources } from './modules/resources/Resources';
import { Decisions } from './modules/decisions/Decisions';
import { Experiments } from './modules/experiments/Experiments';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<MissionControl />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/ventures" element={<Ventures />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/decisions" element={<Decisions />} />
          <Route path="/experiments" element={<Experiments />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

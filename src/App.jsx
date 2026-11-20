// Screens, chosen by the address hash so the browser's Back button works:
//   #/            Home
//   #/svg         Design to SVG
//   #/sizes       Customer Sizes: size chart
//   #/orders/:id  Customer Sizes: team orders
//   #/customers/:id  Customer Sizes: previous customers
//   #/projects    Projects
import { useEffect, useState } from 'react';
import DesignToSvg from './DesignToSvg.jsx';
import Home from './pages/Home.jsx';
import SizeChart from './pages/SizeChart.jsx';
import TeamOrders from './pages/TeamOrders.jsx';
import Customers from './pages/Customers.jsx';
import Projects from './pages/Projects.jsx';

function readRoute() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { page: parts[0] ?? '', id: parts[1] ?? null };
}

export function go(path) {
  window.location.hash = path;
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  switch (route.page) {
    case 'svg': return <DesignToSvg />;
    case 'sizes': return <SizeChart />;
    case 'orders': return <TeamOrders id={route.id} />;
    case 'customers': return <Customers id={route.id} />;
    case 'projects': return <Projects />;
    default: return <Home />;
  }
}

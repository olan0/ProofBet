import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import CreateBet from "./CreateBet";

import BetDetails from "./BetDetails";

import Admin from "./Admin";

import SmartContracts from "./SmartContracts";

import Documentation from "./Documentation";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    CreateBet: CreateBet,
    
    BetDetails: BetDetails,
    
    Admin: Admin,
    
    SmartContracts: SmartContracts,
    
    Documentation: Documentation,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/CreateBet" element={<CreateBet />} />
                
                <Route path="/BetDetails" element={<BetDetails />} />
                
                <Route path="/Admin" element={<Admin />} />
                
                <Route path="/SmartContracts" element={<SmartContracts />} />
                
                <Route path="/Documentation" element={<Documentation />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
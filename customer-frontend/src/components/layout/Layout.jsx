import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import MiniCartDrawer from './MiniCartDrawer';
import DeliveredReviewModal from './DeliveredReviewModal';
import WhatsAppButton from '../common/WhatsAppButton';

export default function Layout({ children, whatsappProductName }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-text">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <MiniCartDrawer />
      <DeliveredReviewModal />
      <WhatsAppButton productName={whatsappProductName} />
    </div>
  );
}

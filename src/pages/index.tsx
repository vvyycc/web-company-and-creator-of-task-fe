// src/pages/index.tsx
import type { NextPage } from 'next';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import ServicesSection from '@/components/ServicesSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import ToolsSection from '@/components/ToolsSection';
import ContactSection from '@/components/ContactSection';

const Home: NextPage = () => {
  return (
    <>
      <Header />

      <main className="bg-slate-50">
        {/* HERO */}
        <section id="hero" className="border-b border-slate-100">
          <div className="mx-auto flex min-h-[80vh] max-w-6xl flex-col justify-center px-4 py-12 md:px-6 md:py-20">
            <Hero />
          </div>
        </section>

        {/* SERVICIOS */}
        <section id="services" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <ServicesSection />
          </div>
        </section>

        {/* CÓMO TRABAJAMOS */}
        <section id="how-we-work" className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <HowItWorksSection />
          </div>
        </section>

        {/* HERRAMIENTAS */}
        <section id="tools" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <ToolsSection />
          </div>
        </section>

        {/* CONTACTO */}
        <section id="contact" className="bg-slate-950 text-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <ContactSection />
          </div>
        </section>
      </main>
    </>
  );
};

export default Home;

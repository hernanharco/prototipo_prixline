import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { YoutubeSection } from './components/YoutubeSection';
import { Features } from './components/Features';
import { Courses } from './components/Courses';
import { Testimonials } from './components/Testimonials';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Header />
      <main>
        <Hero />
        <YoutubeSection />
        <Features />
        <Courses />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}

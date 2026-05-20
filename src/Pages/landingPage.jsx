import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import LPhero from "../Images/LP hero.mp4";
import About from "../Images/About.jpg";
import one from "../Images/1.jpg";
import two from "../Images/2.jpg";
import tooGig from "../Images/TooGig.png";

import Footer from "../components/footer";

// ADD AUTHMODAL IMPORT
import AuthModal from "../components/AuthModal"; // adjust path if needed

const LandingPage = () => {
  const navigate = useNavigate();

  // MODAL STATE
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">

      {/* Navbar */}
 <nav className="absolute top-0 left-0 w-full flex justify-between items-center p-8 bg-transparent z-50">
  {/* Logo */}
  <div className="flex items-center space-x-2">
    <img src={tooGig} alt="TooGig Logo" className="w-30 h-8 sm:w-30 sm:h-20 object-contain" />
   
  </div>

  {/* Buttons */}
  <div className="space-x-2 sm:space-x-4">
    <button
      onClick={() => setShowAuth(true)}
      className="border border-white text-white py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg hover:bg-green-700 transition-colors"
    >
      Login
    </button>

    <button
      onClick={() => setShowAuth(true)}
      className="border border-white text-white py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg hover:bg-green-700 transition-colors"
    >
      Sign Up
    </button>
  </div>
</nav>



      {/* HERO SECTION WITH BACKGROUND VIDEO */}
      <div className="relative w-full h-[100vh] flex justify-center items-center text-center">

        {/* Background Video */}
        <video
          className="absolute top-0 left-0 w-full h-full object-cover"
          src={LPhero}
          autoPlay
          muted
          loop
          playsInline
        />
        
        <div className="absolute inset-0 bg-black/40"></div>

        {/* HERO CONTENT */}
        <div className="relative z-10 text-white px-6">
          <h2 className="text-5xl font-bold mb-6 drop-shadow-md">
          Save More on Every Gig
          </h2>
          <p className="text-xl mb-8 drop-shadow-md">
            Unlock Freelance Services With Instant Discount
          </p>
        </div>

      </div>

      {/* ABOUT SECTION */}
      <section className="relative w-full overflow-hidden bg-white">

        {/* MAIN GRID */}
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 items-center py-24 px-6 relative z-10">

          {/* LEFT TEXT */}
          <div className="px-6">
            <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
              About Us
            </h2>

            <p className="text-gray-700 text-lg leading-relaxed">
            Toogig is a discount powered freelance marketplace that gives you instant savings on top-quality services.
            We’re here to make freelance services affordable, transparent, and accessible for everyone, from small businesses to creators and startups.
            </p>
          </div>

          {/* RIGHT IMAGE */}
          <div className="flex justify-center md:justify-end relative mt-10 md:mt-0">
            <img
              src={About}
              alt="Cheers Image"
              className="w-[400px] md:w-[500px] relative z-10"
            />
          </div>

        </div>

        {/* CURVED SPLIT SHAPE */}
        <div className="absolute top-0 right-0 w-[70%] h-full bg-green-100 
          rounded-l-[120px] md:rounded-l-[200px]"></div>

      </section>
      {/* FEATURES SECTION – FIVERR STYLE */}
<section className="bg-white py-20 px-6">
  <div className="max-w-7xl mx-auto text-center">

    {/* HEADING */}
    <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-12">
      Make it all happen with freelancers
    </h2>

    {/* FEATURES GRID */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-12">

      {/* Feature 1 */}
      <div className="flex flex-col items-center text-center">
        <div className="text-4xl mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900 mb-2">
          Access a pool of top talent
        </p>
        <p className="text-gray-600 text-sm">
          Across 700+ categories
        </p>
      </div>

      {/* Feature 2 */}
      <div className="flex flex-col items-center text-center">
        <div className="text-4xl mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v6h6M20 20v-6h-6M4 20v-6h6M20 4v6h-6" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900 mb-2">
          Simple, easy-to-use experience
        </p>
        <p className="text-gray-600 text-sm">
          Enjoy seamless matching with freelancers
        </p>
      </div>

      {/* Feature 3 */}
      <div className="flex flex-col items-center text-center">
        <div className="text-4xl mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900 mb-2">
          Quality work, fast
        </p>
        <p className="text-gray-600 text-sm">
          Delivered on time and within budget
        </p>
      </div>

      {/* Feature 4 */}
      <div className="flex flex-col items-center text-center">
        <div className="text-4xl mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a5 5 0 00-10 0v2H5v12h14V9h-2zM9 7a3 3 0 016 0v2H9V7z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900 mb-2">
          Pay only when you're happy
        </p>
        <p className="text-gray-600 text-sm">
          Full control and transparency
        </p>
      </div>

    </div>

    {/* JOIN BUTTON */}
    <div className="mt-12">
      <button
        onClick={() => setShowAuth(true)}
        className="bg-black text-white py-3 px-8 rounded-lg text-lg font-semibold hover:bg-gray-800 transition"
      >
        Join now
      </button>
    </div>

  </div>
</section>
{


/* FIVERR LOGO MAKER STYLE SECTION */}
<section className="bg-[#fdeee7] sm:px-20 px-4 sm:py-10 py-4 sm:m-20 rounded-3xl">
  <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-5 items-center">

    {/* LEFT SIDE CONTENT */}
    <div className="space-y-6">
 {/* Heading */}
      <h2 className="sm:text-6xl text-4xl font-bold text-gray-900 leading-tight">
       Experience more value, more flexibility, and more savings with 
        <span className="text-orange-500 font-italic"> Toogig.</span>
      </h2>

  
    </div>

    {/* RIGHT SIDE IMAGES */}
    <div className="flex justify-center md:justify-end items-center gap-6">

      {/* Left small card */}
      <div className="bg-white p-4 rounded-xl shadow-md w-40 h-48 flex items-center justify-center">
        <img
          src={one}
          alt="Small Logo Sample"
          className="object-contain w-full"
        />
      </div>

      {/* Right tall card */}
      <div className="bg-white p-4 rounded-xl shadow-md w-44 h-64 flex items-center justify-center">
        <img
          src={two}
          alt="Tall Logo Sample"
          className=""
        />
      </div>

    </div>

  </div>
</section>



      {/* AUTH MODAL (RENDERS LAST SO IT OVERLAYS EVERYTHING) */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <Footer />

    </div>
  );
};

export default LandingPage;

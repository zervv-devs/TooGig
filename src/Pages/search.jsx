import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import CategoryFilter from "../components/CategoryFilter";
import Navbar from "../components/Navbar";
import emailjs from "emailjs-com";
import Footer from "../components/footer";

const Search = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [filteredGigs, setFilteredGigs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [tagSearch, setTagSearch] = useState("");

  const queryParams = new URLSearchParams(location.search);
  const category = queryParams.get("category")?.toLowerCase().trim();
  const subcategory = queryParams.get("subcategory")?.toLowerCase().trim();
  const tag = queryParams.get("tag")?.toLowerCase().trim();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // ✅ FIXED — Fetch only Approved + Visible gigs
  useEffect(() => {
    const fetchGigs = async () => {
      // ⭐ Only approved & visible gigs
      const q = query(
        collection(db, "promotedGigs"),
        where("status", "==", "approved"),
        where("visible", "==", true)
      );

      const snapshot = await getDocs(q);
      const gigs = snapshot.docs.map((doc) => doc.data());

      // ⭐ Apply your same filtering
      const filtered = gigs.filter((gig) => {
        const gigCat = gig.category?.toLowerCase().trim() || "";
        const gigSub = gig.subcategory?.toLowerCase().trim() || "";
        const gigTitle = gig.gigTitle?.toLowerCase() || "";

        const gigTags = Array.isArray(gig.tags)
          ? gig.tags.map((t) => t.toLowerCase().trim())
          : gig.tags
          ? gig.tags.toString().split(",").map((t) => t.toLowerCase().trim())
          : [];

        const matchCat = category ? gigCat.includes(category) : true;
        const matchSub = subcategory ? gigSub.includes(subcategory) : true;
        const matchTag = tag
          ? gigTitle.includes(tag) || gigTags.includes(tag)
          : true;

        return matchCat && matchSub && matchTag;
      });

      setFilteredGigs(filtered);
      setCurrentPage(1);
    };

    fetchGigs();
  }, [category, subcategory, tag]);

  const handleSearch = () => {
    const newTag = tagSearch.trim().toLowerCase();
    if (newTag) {
      navigate(`/search?tag=${newTag}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const SERVICE_ID = "service_bi2xmdb";
  const TEMPLATE_ID = "template_d5k9y4k";
  const PUBLIC_KEY = "j8VnXuRx-HiUjs4h1";

  const generateCouponCode = () => {
    const prefix = "FVR";
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${random}`;
  };

  const handleGetCoupon = (gig) => {
    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      alert("Please log in to receive your coupon.");
      return;
    }

    const templateParams = {
      user_email: userEmail,
      gig_title: gig?.gigTitle || "Fiverr Gig",
      discount: gig?.discount || "0",
      coupon: gig?.couponCode || generateCouponCode(),
      gig_link: gig?.gigLink || "#",
      name: "Fiverr Deals Bot",
      email: userEmail,
    };

    emailjs
      .send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
      .then(() => {
        alert("🎉 Coupon sent to your email!");
      })
      .catch((error) => {
        console.error("Email send error:", error);
        alert("Failed to send coupon. Please try again.");
      });
  };
  // Pagination
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 9; // 3 x 3 grid

const indexOfLast = currentPage * itemsPerPage;
const indexOfFirst = indexOfLast - itemsPerPage;

const currentGigs = filteredGigs.slice(indexOfFirst, indexOfLast);

const totalPages = Math.ceil(filteredGigs.length / itemsPerPage);

const nextPage = () => {
  if (currentPage < totalPages) setCurrentPage((p) => p + 1);
};

const prevPage = () => {
  if (currentPage > 1) setCurrentPage((p) => p - 1);
};


  return (
    <>
      <Navbar user={user} />

      <CategoryFilter
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />

      <div className="bg-white min-h-screen">
     
        <h1 className="text-3xl font-bold mb-6 text-center text-white bg-green-700 p-4">
          Search Result: {category || "All"}
          {subcategory && ` / ${subcategory}`}
          {tag && ` / ${tag}`}
        </h1>
  <div className="max-w-7xl mx-auto px-6">
        {filteredGigs.length === 0 ? (
          <p className="text-gray-600 text-center">No gigs found for this filter.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
            {currentGigs.map((gig, idx) => (
 <div
  key={idx}
  className="bg-white rounded-lg shadow-md border overflow-hidden flex flex-col"
>
  <div className="relative">
    <a
      href={gig.affiliateLink || gig.gigLink}
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        src={gig.gigImage}
        alt={gig.gigTitle}
        className="w-full h-48 object-cover"
      />
    </a>

    {/* ⭐ SAME DISCOUNT BADGE YOU MADE ON BUYER PAGE */}
    {gig.discount && (
      <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
        -{gig.discount}%
      </div>
    )}
  </div>

  <div className="p-4 flex flex-col flex-grow justify-between">
    <div>
      <a
        href={gig.affiliateLink || gig.gigLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        <h3 className="font-bold text-lg text-gray-800 mb-2">
          {gig.gigTitle}
        </h3>
      </a>
      <p className="text-sm text-gray-500 mb-4">
        {gig.category} / {gig.subcategory || "N/A"}
      </p>
    </div>

 {user ? (
  <div className="flex flex-col gap-2 mt-auto">
    <button
      onClick={() => handleGetCoupon(gig)}
      className="w-full bg-green-700 hover:bg-green-800 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
    >
      Get a Coupon Code
    </button>
    <button
      onClick={() => navigate(`/chat?seller=${gig.sellerName}`)}
      className="w-full border border-green-700 text-green-700 hover:bg-green-50 text-sm font-medium py-2 px-4 rounded"
    >
      Contact Seller
    </button>
  </div>
) : (
  <div className="flex flex-col gap-2 mt-auto">
    <button
      onClick={() => handleGetCoupon(gig)}
      className="w-full bg-green-700 hover:bg-green-800 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
    >
      Get a Coupon Code
    </button>
    <p className="text-sm text-red-600 font-medium text-center py-2">
      Login to contact seller
    </p>
  </div>
)}
  </div>
</div>

            ))}
          </div>
        )}
        <div className="flex justify-center items-center gap-4 mt-6 mb-10">
  <button
    onClick={prevPage}
    disabled={currentPage === 1}
    className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
  >
    Previous
  </button>

  <span className="font-semibold text-gray-700">
    Page {currentPage} of {totalPages}
  </span>

  <button
    onClick={nextPage}
    disabled={currentPage === totalPages}
    className="px-4 py-2 bg-green-800 text-white rounded disabled:opacity-50"
  >
    Next
  </button>
</div>
     </div>
      </div>

      <Footer />
    </>
  );
};

export default Search;

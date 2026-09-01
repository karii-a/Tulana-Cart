import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { useNavigate } from "react-router-dom";

function ProductCard({ product }) {
  const { lang } = useLang();
  const { user } = useAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const navigate = useNavigate();

  const prices = product.product_prices ?? [];
  const nums = prices.map((p) => p.price);
  const minPrice = nums.length > 0 ? Math.min(...nums) : null;
  const wishlisted = isWishlisted(product.id);

  function handleWishlistClick() {
    if (!user) {
      navigate("/login");
      return;
    }
    toggleWishlist(product.id);
  }

  return (
    <div className="product-card">
      <button
        className={`product-card__wishlist ${wishlisted ? "active" : ""}`}
        onClick={handleWishlistClick}
        aria-label={lang === "en" ? "Toggle wishlist" : "इच्छासूची टगल गर्नुहोस्"}
      >
        {wishlisted ? "♥" : "♡"}
      </button>

      <div
        className="product-card__body"
        onClick={() => navigate(`/product/${product.id}`)}
        style={{ cursor: "pointer" }}
      >
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="product-card__image"
            loading="lazy"
          />
        )}

        <h3>{product.name}</h3>

        <p className="product-card__brand">
          {product.brand}
        </p>

        {minPrice !== null && (
          <p className="product-card__price">
            From <strong>Rs. {minPrice}</strong>
          </p>
        )}

        <div className="product-card__stores">
          {prices.map((pp, i) => (
            <a
              key={i}
              href={pp.store_product_url || "#"}
              target="_blank"
              rel="noreferrer"
              className={`store-tag ${pp.price === minPrice ? "store-tag--best" : ""} ${pp.in_stock === false ? "store-tag--oos" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!pp.store_product_url) e.preventDefault();
              }}
            >
              {pp.stores?.name} - Rs. {pp.price}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
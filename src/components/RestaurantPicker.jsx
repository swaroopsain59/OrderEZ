function RestaurantPicker({ restaurants, title, description, adminMode }) {
  return (
    <section className="workspace single-column">
      <section className="ops-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{adminMode ? "Restaurant admin" : "Restaurant directory"}</p>
            <h3>{title}</h3>
          </div>
        </div>
        <p className="hero-text picker-copy">{description}</p>

        <div className="picker-grid">
          {restaurants.map((restaurant) => (
            <article key={restaurant.slug} className="menu-item">
              <div className="menu-item-head">
                <div>
                  <p className="item-category">{restaurant.slug}</p>
                  <h4>{restaurant.name}</h4>
                </div>
                <span className="item-tag">{restaurant.tableCount} tables</span>
              </div>
              <p className="item-description">{restaurant.tagline}</p>
              <p className="item-description">{restaurant.addressLine}</p>
              <div className="menu-item-foot">
                <a className="secondary-link" href={`/r/${restaurant.slug}/table/T1`}>
                  Open guest demo
                </a>
                <a className="primary-button compact" href={`/admin/${restaurant.slug}`}>
                  {adminMode ? "Manage" : "Admin"}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default RestaurantPicker;

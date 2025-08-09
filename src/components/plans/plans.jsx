import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './plans.css';

const PLANS_PER_PAGE = 6;

// Replace this with your actual API endpoint when ready
const API_URL = 'http://127.0.0.1:8000/api/plans/';

const Plans = () => {
  const [plans, setPlans] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const totalPages = Math.ceil(plans.length / PLANS_PER_PAGE);

  // Fetch plans on component mount or page change
  useEffect(() => {
    const fetchPlans = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(API_URL);
        // Assume response.data is an array of plans
        setPlans(response.data);
      } catch (err) {
        setError('Failed to load plans. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []); // empty dependency to run once on mount

  // Get plans for current page
  const currentPlans = plans.slice(
    (currentPage - 1) * PLANS_PER_PAGE,
    currentPage * PLANS_PER_PAGE
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  if (loading) return <div className="text-center py-5">Loading plans...</div>;
  if (error) return <div className="text-center text-danger py-5">{error}</div>;

  return (
    <div className="container py-4">
      <h2 className="text-primary mb-4">Our Plans</h2>

      <div className="row g-4">
        {currentPlans.map(({ id, title, description, price }) => (
          <div key={id} className="col-12 col-sm-6 col-md-4">
            <div className="plan-card shadow rounded-4 p-4 h-100 d-flex flex-column justify-content-between">
              <h5 className="plan-title mb-3">{title}</h5>
              <p className="plan-desc flex-grow-1">{description}</p>
              <div className="d-flex justify-content-between align-items-center mt-3">
                <span className="plan-price fw-bold">{price}</span>
                <button className="btn btn-primary btn-sm rounded-pill">
                  Select
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {plans.length > PLANS_PER_PAGE && (
        <nav aria-label="Plans pagination" className="mt-5 d-flex justify-content-center">
          <ul className="pagination pagination-sm">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => goToPage(currentPage - 1)}>
                Previous
              </button>
            </li>

            {[...Array(totalPages)].map((_, idx) => (
              <li
                key={idx}
                className={`page-item ${currentPage === idx + 1 ? 'active' : ''}`}
              >
                <button className="page-link" onClick={() => goToPage(idx + 1)}>
                  {idx + 1}
                </button>
              </li>
            ))}

            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => goToPage(currentPage + 1)}>
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
};

export default Plans;

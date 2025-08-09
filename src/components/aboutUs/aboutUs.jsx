import React from 'react';
import Rocket from '../../assets/aboutUs/rocket.svg';
import './AboutUs.css';

const AboutUs = () => {
  return (
    <div className="container py-5">
      <h2 className="text-primary mb-4">About Us</h2>
      <div className="row align-items-center">
        <div className="col-md-6 mb-4 mb-md-0">
          <img
            src={Rocket}
            alt="Rocket icon"
            className="img-fluid rounded shadow"
          />
        </div>
        <div className="col-md-6">
          <p className="lead">
            At PaaS Deployer, we are dedicated to simplifying cloud deployments for developers worldwide.
            Our mission is to provide a seamless platform that empowers teams to build, deploy, and scale applications effortlessly.
          </p>
          <p>
            Founded in 2025, we combine expertise in cloud technologies and developer tools to bring you
            an intuitive and reliable service. Our team is passionate about innovation, security, and delivering
            outstanding user experiences.
          </p>
          <p>
            Whether you’re a startup or an enterprise, PaaS Deployer is here to support your journey in the cloud.
            Join us as we revolutionize the way applications are deployed and managed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;

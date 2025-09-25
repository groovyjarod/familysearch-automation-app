import { Link } from "react-router-dom";
import { Button } from "@chakra-ui/react";
import React from 'react'

const LinkButton = ({ destination, buttonText, buttonClass, handleBackButton }) => {
  return (
    <Link to={destination} onClick={handleBackButton}>
        <Button className={buttonClass}>{buttonText}</Button>
    </Link>
  )
}

export default LinkButton
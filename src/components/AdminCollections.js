                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={book.bookCoverImgLink} 
                      alt={book.title} 
                      className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500 ease-in-out"
                      onError={(e) => {
                        console.log("Image failed to load:", book.bookCoverImgLink);
                        e.target.onerror = null; // Prevent infinite loop
                        // Use a simple colored background with text instead of external placeholder
                        e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%20viewBox%3D%220%200%20400%20600%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22400%22%20height%3D%22600%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20x%3D%22200%22%20y%3D%22300%22%3E%3Ctspan%20x%3D%22200%22%20dy%3D%220%22%3EBook%20Cover%3C%2Ftspan%3E%3Ctspan%20x%3D%22200%22%20dy%3D%2230%22%3ENot%20Available%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fsvg%3E";
                      }}
                    />
                  </div> 
const { createSystemNotification } = require('./notificationController');

exports.subscribeToBook = async (req, res) => {
  try {
    const { bookId } = req.body;
    const userId = req.user._id;

    // Check if the book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    // Check if the user is already subscribed
    const existingSubscription = await Subscription.findOne({
      userId,
      bookId
    });

    if (existingSubscription) {
      return res.status(400).json({ error: "You are already subscribed to this book" });
    }

    // Create a new subscription
    const subscription = new Subscription({
      userId,
      bookId,
      bookTitle: book.title,
      bookCoverImgLink: book.coverImageUrl || ""
    });

    await subscription.save();

    // Create a notification for the user
    await createSystemNotification(
      userId,
      "New Book Subscription",
      `You've successfully subscribed to "${book.title}". Start exploring chapters now!`
    );

    res.status(201).json({ 
      message: "Successfully subscribed to the book",
      subscription
    });
  } catch (error) {
    console.error("Error subscribing to book:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}; 
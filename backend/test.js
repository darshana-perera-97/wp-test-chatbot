const url = "https://graph.facebook.com/v25.0/1120886881107759/messages";
const accessToken =
  "EAAR7cSxfW0oBRfVtYgiwVEGptlE4z8oiADZCRtQgZBIs1YUFJbSCmYrqPAIJZBLOt97j6PgLZCDxsxElzqAerQMoDc0BdwqstI9eo9qLfK3TZBsGrmujqvwZAobiKh14WWcXTglhBmeIw6lrf0RfZCjLblZA4PAxdZAHxgNZCRa5V5ZBtbUZCUh5laZBIn1KvoLZAe5xvcni177tD9IAtofOBZC5u508rh02qoG1exd9GOjcJOk6aqqTSUATqX6NqVMUvPWqk8l0zXEvca2n3luZAtmCHVtQ";

const data = {
  messaging_product: "whatsapp",
  to: "94771461925",
  type: "template",
  template: {
    name: "hello2",
    language: {
      code: "en_GB",
    },
  },
};

async function sendWhatsAppMessage() {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const responseBody = await response.text();

    console.log(`HTTP/1.1 ${response.status} ${response.statusText}`);
    response.headers.forEach((value, key) => {
      console.log(`${key}: ${value}`);
    });
    console.log("\n" + responseBody);
  } catch (error) {
    console.error("Request failed:", error);
  }
}

sendWhatsAppMessage();
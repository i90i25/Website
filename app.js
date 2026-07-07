/**
 * NILE RUHI - Application Controller
 * Handles State, Checkout Workflow, Mock Auth, simulated Razorpay SDK Gateway,
 * LocalStorage management, Admin Dashboard, and WhatsApp API Simulation.
 */

class NileRuhiApp {
  constructor() {
    // Application States
    this.cart = [];
    this.currentUser = null; // null if guest/unauthorized, otherwise {name, email, phone, isGuest}
    this.shippingAddress = null;
    this.selectedPaymentMethod = 'upi'; // 'upi' or 'card'
    this.orders = JSON.parse(localStorage.getItem('nile_ruhi_orders')) || [];
    this.currentView = 'catalog'; // 'catalog', 'checkout', 'success', 'admin'
    this.activeProduct = null;
    this.selectedSize = 'M';
    this.otpState = false;

    // Dom Elements Cache
    this.dom = {};
  }

  init() {
    this.cacheDomElements();
    this.bindEvents();
    this.renderCatalog();
    this.updateCartUI();
    this.updateAuthUI();
    
    // Check url hash for direct admin routing (merchant utility)
    if (window.location.hash === '#admin') {
      this.showView('admin');
    }
  }

  cacheDomElements() {
    this.dom = {
      productList: document.getElementById('product-list'),
      productDetailModal: document.getElementById('product-detail-modal'),
      productDetailContent: document.getElementById('product-detail-content'),
      authModal: document.getElementById('auth-modal'),
      cartOverlay: document.getElementById('cart-overlay'),
      cartItemsList: document.getElementById('cart-items-list'),
      cartTotalValue: document.getElementById('cart-total-value'),
      headerCartCount: document.getElementById('header-cart-count'),
      headerUserText: document.getElementById('header-user-text'),
      headerUserTag: document.getElementById('header-user-tag'),
      
      // Checkout flow sections
      catalogView: document.getElementById('catalog-view'),
      checkoutView: document.getElementById('checkout-view'),
      addressStep: document.getElementById('address-step'),
      paymentStep: document.getElementById('payment-step'),
      successView: document.getElementById('success-view'),
      adminView: document.getElementById('admin-view'),
      
      // Step indicators
      stepIndicatorAddress: document.getElementById('step-indicator-address'),
      stepIndicatorPayment: document.getElementById('step-indicator-payment'),
      
      // Inputs
      shippingForm: document.getElementById('shipping-form'),
      shipName: document.getElementById('ship-name'),
      shipPhone: document.getElementById('ship-phone'),
      shipEmail: document.getElementById('ship-email'),
      shipAddress1: document.getElementById('ship-address1'),
      shipAddress2: document.getElementById('ship-address2'),
      shipCity: document.getElementById('ship-city'),
      shipState: document.getElementById('ship-state'),
      shipPincode: document.getElementById('ship-pincode'),
      
      // Payment Display
      paySubtotal: document.getElementById('pay-subtotal'),
      payTotal: document.getElementById('pay-total'),
      
      // Razorpay
      razorpayOverlay: document.getElementById('razorpay-overlay'),
      rpAmountDisplay: document.getElementById('rp-amount-display'),
      rpMainContent: document.getElementById('rp-main-content'),
      
      // Success screen
      receiptDetails: document.getElementById('receipt-details'),
      whatsappAutomationLog: document.getElementById('whatsapp-automation-log'),
      whatsappRedirectBtn: document.getElementById('whatsapp-redirect-btn'),
      
      // Admin screen
      adminOrdersList: document.getElementById('admin-orders-list'),
      
      // Auth forms
      authEmailPanel: document.getElementById('auth-email-panel'),
      authPhonePanel: document.getElementById('auth-phone-panel'),
      tabLogin: document.getElementById('tab-login'),
      tabPhone: document.getElementById('tab-phone'),
      phoneOtpGroup: document.getElementById('phone-otp-group'),
      btnOtpAction: document.getElementById('btn-otp-action'),
      authEmailInput: document.getElementById('auth-email-input'),
      authPhoneInput: document.getElementById('auth-phone-input'),
      authOtpInput: document.getElementById('auth-otp-input')
    };
  }

  bindEvents() {
    // Keep reference checks secure
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#admin') {
        this.showView('admin');
      } else if (window.location.hash === '#catalog' || window.location.hash === '') {
        this.showView('catalog');
      }
    });
  }

  // Routing View Manager
  showView(viewName) {
    this.currentView = viewName;
    
    // Hide all main views
    this.dom.catalogView.classList.add('hidden');
    this.dom.checkoutView.classList.add('hidden');
    this.dom.successView.classList.add('hidden');
    this.dom.adminView.classList.add('hidden');
    
    // Update menu highlighting
    const navLinks = document.querySelectorAll('nav ul li a');
    navLinks.forEach(link => link.classList.remove('active'));

    // Reset hash
    if (viewName !== 'admin') {
      if (window.location.hash === '#admin') {
        history.pushState("", document.title, window.location.pathname + window.location.search);
      }
    }

    if (viewName === 'catalog') {
      this.dom.catalogView.classList.remove('hidden');
      navLinks[0].classList.add('active');
    } else if (viewName === 'checkout') {
      this.dom.checkoutView.classList.remove('hidden');
      this.showCheckoutStep('address');
    } else if (viewName === 'success') {
      this.dom.successView.classList.remove('hidden');
    } else if (viewName === 'admin') {
      this.dom.adminView.classList.remove('hidden');
      navLinks[2].classList.add('active');
      window.location.hash = '#admin';
      this.renderAdminDashboard();
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Render Product Catalog
  renderCatalog(filterCategory = 'All') {
    this.dom.productList.innerHTML = '';
    const filtered = filterCategory === 'All' 
      ? products 
      : products.filter(p => p.category === filterCategory);
      
    filtered.forEach(product => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="product-img-wrapper" onclick="app.openProductDetail(${product.id})">
          <img src="${product.image}" alt="${product.name}" class="product-img">
          ${product.price > 8000 ? '<span class="product-badge">Exclusive</span>' : ''}
        </div>
        <div class="product-info">
          <div class="product-brand">${product.brand}</div>
          <h3 class="product-title" onclick="app.openProductDetail(${product.id})">${product.name}</h3>
          <div class="product-price-row">
            <span class="product-price">₹${product.price.toLocaleString('en-IN')}</span>
            <button class="btn-card-add" onclick="app.quickAdd(${product.id})" title="Quick Add to Cart">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
      `;
      this.dom.productList.appendChild(card);
    });
  }

  filterCategory(category, pillElement) {
    // Deactivate sibling pills
    const pills = document.querySelectorAll('#category-filters .filter-pill');
    pills.forEach(pill => pill.classList.remove('active'));
    
    // Activate clicked
    pillElement.classList.add('active');
    this.renderCatalog(category);
  }

  // Product Details Popup
  openProductDetail(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    this.activeProduct = product;
    this.selectedSize = 'M'; // Reset size selection to medium
    
    this.dom.productDetailContent.innerHTML = `
      <div class="detail-img-side">
        <img src="${product.image}" alt="${product.name}" class="detail-img">
      </div>
      <div class="detail-info-side">
        <div class="detail-brand">${product.brand}</div>
        <h2 class="detail-title">${product.name}</h2>
        <div class="detail-price">₹${product.price.toLocaleString('en-IN')}</div>
        <div class="detail-divider"></div>
        
        <div class="detail-desc-title">Description</div>
        <p class="detail-desc">${product.description}</p>
        
        <div class="detail-sizes">
          <div class="size-label">Select Size</div>
          <div class="size-options">
            <button class="size-btn" onclick="app.selectSize('S', this)">S</button>
            <button class="size-btn active" onclick="app.selectSize('M', this)">M</button>
            <button class="size-btn" onclick="app.selectSize('L', this)">L</button>
            <button class="size-btn" onclick="app.selectSize('XL', this)">XL</button>
          </div>
        </div>
        
        <div class="detail-actions">
          <button class="btn-primary" onclick="app.addActiveProductToCart()" style="display: flex; justify-content: center; gap: 10px;">
            <i class="fa-solid fa-bag-shopping"></i> Add to Cart
          </button>
        </div>
      </div>
    `;
    
    this.dom.productDetailModal.classList.add('active');
  }

  closeProductDetail(event) {
    if (!event || event.target === this.dom.productDetailModal || event.currentTarget === this.dom.productDetailModal) {
      this.dom.productDetailModal.classList.remove('active');
    }
  }

  selectSize(size, btnElement) {
    this.selectedSize = size;
    const buttons = document.querySelectorAll('.size-options .size-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
  }

  // Cart Functions
  toggleCart(isOpen) {
    if (isOpen) {
      this.renderCartItems();
      this.dom.cartOverlay.classList.add('active');
    } else {
      this.dom.cartOverlay.classList.remove('active');
    }
  }

  quickAdd(id) {
    const product = products.find(p => p.id === id);
    if (product) {
      this.addToCart(product, 'M');
      // Toast notification instead of opening cart immediately for better UX
      this.showToast(`Added ${product.name} (M) to Cart!`);
    }
  }

  addActiveProductToCart() {
    if (this.activeProduct) {
      this.addToCart(this.activeProduct, this.selectedSize);
      this.dom.productDetailModal.classList.remove('active');
      this.toggleCart(true); // Open slide out drawer
    }
  }

  addToCart(product, size) {
    const existingIndex = this.cart.findIndex(item => item.product.id === product.id && item.size === size);
    
    if (existingIndex > -1) {
      this.cart[existingIndex].qty += 1;
    } else {
      this.cart.push({
        product: product,
        qty: 1,
        size: size
      });
    }
    
    this.updateCartUI();
  }

  changeQty(index, offset) {
    this.cart[index].qty += offset;
    if (this.cart[index].qty <= 0) {
      this.cart.splice(index, 1);
    }
    this.updateCartUI();
    this.renderCartItems();
  }

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.updateCartUI();
    this.renderCartItems();
  }

  updateCartUI() {
    let count = 0;
    let total = 0;
    
    this.cart.forEach(item => {
      count += item.qty;
      total += item.product.price * item.qty;
    });
    
    this.dom.headerCartCount.innerText = count;
    this.dom.cartTotalValue.innerText = `₹${total.toLocaleString('en-IN')}`;
  }

  renderCartItems() {
    this.dom.cartItemsList.innerHTML = '';
    
    if (this.cart.length === 0) {
      this.dom.cartItemsList.innerHTML = `
        <div class="cart-empty-message">
          <div class="cart-empty-icon"><i class="fa-solid fa-bag-shopping"></i></div>
          <p>Your shopping bag is empty.</p>
          <button class="btn-outline" onclick="app.toggleCart(false)" style="margin-top: 10px;">Continue Browsing</button>
        </div>
      `;
      return;
    }
    
    this.cart.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.innerHTML = `
        <img src="${item.product.image}" alt="${item.product.name}" class="cart-item-img">
        <div class="cart-item-info">
          <div>
            <h4 class="cart-item-name">${item.product.name}</h4>
            <span class="cart-item-size">Size: ${item.size}</span>
          </div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="app.changeQty(${index}, -1)"><i class="fa-solid fa-minus"></i></button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" onclick="app.changeQty(${index}, 1)"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
        <div class="cart-item-right">
          <span class="cart-item-price">₹${(item.product.price * item.qty).toLocaleString('en-IN')}</span>
          <button class="cart-item-remove" onclick="app.removeFromCart(${index})" title="Remove"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `;
      this.dom.cartItemsList.appendChild(itemEl);
    });
  }

  // Auth Overlay Controllers
  openAuthModal() {
    this.dom.authModal.classList.add('active');
  }

  closeAuthModal(event) {
    if (!event || event.target === this.dom.authModal || event.currentTarget === this.dom.authModal) {
      this.dom.authModal.classList.remove('active');
    }
  }

  switchAuthTab(tab) {
    if (tab === 'login') {
      this.dom.tabLogin.classList.add('active');
      this.dom.tabPhone.classList.remove('active');
      this.dom.authEmailPanel.classList.remove('hidden');
      this.dom.authPhonePanel.classList.add('hidden');
    } else {
      this.dom.tabLogin.classList.remove('active');
      this.dom.tabPhone.classList.add('active');
      this.dom.authEmailPanel.classList.add('hidden');
      this.dom.authPhonePanel.classList.remove('hidden');
    }
  }

  handleSocialAuth(provider) {
    // Simulate successful third party authentication
    this.currentUser = {
      name: `${provider} Customer`,
      email: `${provider.toLowerCase()}.user@gmail.com`,
      phone: '9876543210',
      isGuest: false,
      method: provider
    };
    
    this.updateAuthUI();
    this.dom.authModal.classList.remove('active');
    this.showToast(`Logged in successfully with ${provider}!`);
    
    // If user was in middle of checkout, proceed to shipping details
    if (this.currentView === 'catalog' && this.cart.length > 0) {
      this.showView('checkout');
    }
  }

  handleAuthSubmit(type, event) {
    event.preventDefault();
    
    if (type === 'email') {
      const email = this.dom.authEmailInput.value;
      const name = email.split('@')[0];
      this.currentUser = {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: email,
        phone: '9988776655',
        isGuest: false,
        method: 'Email/Gmail'
      };
    } else if (type === 'phone') {
      if (!this.otpState) {
        this.sendOTP();
        return;
      }
      
      const phone = this.dom.authPhoneInput.value;
      const otp = this.dom.authOtpInput.value;
      if (otp !== '123456') {
        alert('Invalid OTP code. Please enter the default code 123456 to test.');
        return;
      }
      
      this.currentUser = {
        name: `Guest Customer (+91 ${phone.substring(0,4)}***)`,
        email: 'phone.user@nileruhi.com',
        phone: phone,
        isGuest: false,
        method: 'Phone OTP'
      };
    }

    this.updateAuthUI();
    this.dom.authModal.classList.remove('active');
    this.showToast('Successfully logged in!');
    
    if (this.cart.length > 0) {
      this.showView('checkout');
    }
  }

  sendOTP() {
    const phone = this.dom.authPhoneInput.value;
    if (!phone || phone.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    
    this.otpState = true;
    this.dom.phoneOtpGroup.classList.remove('hidden');
    this.dom.btnOtpAction.innerText = 'Verify & Proceed';
    this.dom.authOtpInput.required = true;
    this.showToast('Test OTP "123456" sent to your mobile.');
  }

  continueAsGuest() {
    this.currentUser = {
      name: 'Guest Customer',
      email: 'guest@nileruhi.com',
      phone: '0000000000',
      isGuest: true,
      method: 'Guest Mode'
    };
    this.updateAuthUI();
    this.dom.authModal.classList.remove('active');
    this.showToast('Continuing checkout in guest mode.');
    
    if (this.cart.length > 0) {
      this.showView('checkout');
    }
  }

  updateAuthUI() {
    if (this.currentUser) {
      this.dom.headerUserText.innerText = this.currentUser.name;
      this.dom.headerUserTag.classList.add('logged-in');
      
      // Auto-fill shipping form fields if available and logged in (not basic guest)
      if (!this.currentUser.isGuest) {
        if (this.dom.shipName && !this.dom.shipName.value) {
          this.dom.shipName.value = this.currentUser.name;
        }
        if (this.dom.shipPhone && !this.dom.shipPhone.value && this.currentUser.phone !== '9876543210' && this.currentUser.phone !== '0000000000') {
          this.dom.shipPhone.value = this.currentUser.phone;
        }
        if (this.dom.shipEmail && !this.dom.shipEmail.value) {
          this.dom.shipEmail.value = this.currentUser.email;
        }
      }
    } else {
      this.dom.headerUserText.innerText = 'Continue as Guest';
      this.dom.headerUserTag.classList.remove('logged-in');
    }
  }

  // Ordering & Checkout Steps Flow
  proceedToCheckout() {
    if (this.cart.length === 0) {
      alert('Please add some items to your cart before checking out.');
      return;
    }
    
    this.toggleCart(false); // Close cart drawer

    if (!this.currentUser) {
      this.openAuthModal(); // Require registration / guest switch
    } else {
      this.showView('checkout');
    }
  }

  showCheckoutStep(step) {
    if (step === 'address') {
      this.dom.addressStep.classList.remove('hidden');
      this.dom.paymentStep.classList.add('hidden');
      this.dom.stepIndicatorAddress.className = 'step-item active';
      this.dom.stepIndicatorPayment.className = 'step-item';
    } else if (step === 'payment') {
      this.dom.addressStep.classList.add('hidden');
      this.dom.paymentStep.classList.remove('hidden');
      this.dom.stepIndicatorAddress.className = 'step-item completed';
      this.dom.stepIndicatorPayment.className = 'step-item active';
      this.updatePaymentSummary();
    }
  }

  submitShipping(event) {
    event.preventDefault();
    
    this.shippingAddress = {
      name: this.dom.shipName.value,
      phone: this.dom.shipPhone.value,
      email: this.dom.shipEmail.value,
      address1: this.dom.shipAddress1.value,
      address2: this.dom.shipAddress2.value,
      city: this.dom.shipCity.value,
      state: this.dom.shipState.value,
      pincode: this.dom.shipPincode.value
    };
    
    this.showCheckoutStep('payment');
  }

  backToAddress() {
    this.showCheckoutStep('address');
  }

  updatePaymentSummary() {
    let subtotal = 0;
    this.cart.forEach(item => {
      subtotal += item.product.price * item.qty;
    });
    
    this.dom.paySubtotal.innerText = `₹${subtotal.toLocaleString('en-IN')}`;
    this.dom.payTotal.innerText = `₹${subtotal.toLocaleString('en-IN')}`;
    this.dom.rpAmountDisplay.innerText = `₹${subtotal.toLocaleString('en-IN')}.00`;
  }

  selectPaymentMethod(method, element) {
    this.selectedPaymentMethod = method;
    const options = document.querySelectorAll('.pay-method-option');
    options.forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
  }

  // Razorpay Gateway Orchestrator
  triggerRazorpayModal() {
    this.dom.razorpayOverlay.classList.add('active');
    this.renderRazorpayGateway();
  }

  closeRazorpayModal() {
    this.dom.razorpayOverlay.classList.remove('active');
  }

  renderRazorpayGateway() {
    let total = 0;
    this.cart.forEach(item => total += item.product.price * item.qty);
    
    if (this.selectedPaymentMethod === 'upi') {
      this.dom.rpMainContent.innerHTML = `
        <div class="rp-header">
          <span class="rp-header-title">Pay via UPI</span>
          <span class="rp-close-btn" onclick="app.closeRazorpayModal()"><i class="fa-solid fa-xmark"></i></span>
        </div>
        
        <p class="rp-label" style="margin-bottom: 12px;">Preferred UPI Apps</p>
        <div class="rp-upi-grid">
          <div class="rp-upi-item active" id="upi-gpay" onclick="app.selectRpUpi('gpay')">
            <img src="https://img.icons8.com/color/48/google-pay.png" class="rp-upi-logo" alt="GPay">
            <span class="rp-upi-name">Google Pay</span>
          </div>
          <div class="rp-upi-item" id="upi-phonepe" onclick="app.selectRpUpi('phonepe')">
            <img src="https://img.icons8.com/color/48/phonepe.png" class="rp-upi-logo" alt="PhonePe">
            <span class="rp-upi-name">PhonePe</span>
          </div>
          <div class="rp-upi-item" id="upi-paytm" onclick="app.selectRpUpi('paytm')">
            <img src="https://img.icons8.com/color/48/paytm.png" class="rp-upi-logo" alt="Paytm">
            <span class="rp-upi-name">Paytm</span>
          </div>
        </div>

        <div class="rp-form-group">
          <label class="rp-label">Enter UPI ID / VPA</label>
          <input type="text" class="rp-input" id="rp-vpa-input" placeholder="mobile@upi" value="${this.shippingAddress.phone}@okaxis">
          <p style="font-size: 11px; color: #64748b; margin-top: 4px;">For testing, you can input any mock UPI address.</p>
        </div>

        <button class="rp-pay-btn" onclick="app.executePayment()">Pay ₹${total.toLocaleString('en-IN')}</button>
        <p style="font-size: 10px; color: #64748b; text-align: center; margin-top: 15px;">
          <i class="fa-solid fa-lock"></i> 256-bit encryption. Safe & Secure.
        </p>
      `;
    } else {
      this.dom.rpMainContent.innerHTML = `
        <div class="rp-header">
          <span class="rp-header-title">Pay via Card</span>
          <span class="rp-close-btn" onclick="app.closeRazorpayModal()"><i class="fa-solid fa-xmark"></i></span>
        </div>
        
        <div class="rp-form-group">
          <label class="rp-label">Card Number</label>
          <input type="text" class="rp-input" id="rp-card-num" placeholder="4111 2222 3333 4444" maxlength="19" oninput="app.formatCardNumber(this)" required>
        </div>

        <div class="rp-card-grid">
          <div class="rp-form-group">
            <label class="rp-label">Expiry Date</label>
            <input type="text" class="rp-input" id="rp-card-expiry" placeholder="MM/YY" maxlength="5" oninput="app.formatCardExpiry(this)" required>
          </div>
          <div class="rp-form-group">
            <label class="rp-label">CVV</label>
            <input type="password" class="rp-input" id="rp-card-cvv" placeholder="123" maxlength="3" required>
          </div>
        </div>

        <div class="rp-form-group">
          <label class="rp-label">Card Holder Name</label>
          <input type="text" class="rp-input" id="rp-card-name" value="${this.shippingAddress.name}" placeholder="John Doe" required>
        </div>

        <button class="rp-pay-btn" onclick="app.executePayment()">Pay ₹${total.toLocaleString('en-IN')}</button>
        <p style="font-size: 10px; color: #64748b; text-align: center; margin-top: 15px;">
          <i class="fa-solid fa-lock"></i> 256-bit encryption. Safe & Secure.
        </p>
      `;
    }
  }

  selectRpUpi(provider) {
    const items = document.querySelectorAll('.rp-upi-item');
    items.forEach(it => it.classList.remove('active'));
    document.getElementById(`upi-${provider}`).classList.add('active');
    
    // Auto fill VPA handle
    const suffix = provider === 'gpay' ? 'okaxis' : (provider === 'phonepe' ? 'ybl' : 'paytm');
    document.getElementById('rp-vpa-input').value = `${this.shippingAddress.phone}@${suffix}`;
  }

  formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += value[i];
    }
    input.value = formatted;
  }

  formatCardExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 2) {
      input.value = value.substring(0, 2) + '/' + value.substring(2, 4);
    } else {
      input.value = value;
    }
  }

  executePayment() {
    // Form validations inside Razorpay popup
    if (this.selectedPaymentMethod === 'upi') {
      const vpa = document.getElementById('rp-vpa-input').value;
      if (!vpa || !vpa.includes('@')) {
        alert('Please enter a valid UPI VPA handle.');
        return;
      }
    } else {
      const cardNum = document.getElementById('rp-card-num').value;
      const cardExpiry = document.getElementById('rp-card-expiry').value;
      const cardCvv = document.getElementById('rp-card-cvv').value;
      
      if (cardNum.replace(/\s/g, '').length < 16) {
        alert('Please enter a valid 16-digit card number.');
        return;
      }
      if (cardExpiry.length < 5 || !cardExpiry.includes('/')) {
        alert('Please enter expiration in MM/YY format.');
        return;
      }
      if (cardCvv.length < 3) {
        alert('Please enter a valid 3-digit CVV pin.');
        return;
      }
    }

    // Switch Razorpay pane to dynamic loader
    this.dom.rpMainContent.innerHTML = `
      <div class="rp-loader">
        <div class="rp-spinner"></div>
        <h3 class="rp-loader-title">Verifying Payment...</h3>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Securing network handshake with bank gateway</p>
        <p style="font-size: 11px; color: #94a3b8;">Do not close this window or hit back button</p>
      </div>
    `;

    // Process network mock delay
    setTimeout(() => {
      this.closeRazorpayModal();
      this.placeOrder();
    }, 2800);
  }

  // Order Placement, Persistence & Automation Logs
  placeOrder() {
    let total = 0;
    const itemsSummary = this.cart.map(item => {
      total += item.product.price * item.qty;
      return {
        id: item.product.id,
        name: item.product.name,
        qty: item.qty,
        size: item.size,
        price: item.product.price
      };
    });

    const orderId = `NR-${2026}${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = {
      orderId: orderId,
      date: new Date().toLocaleString('en-IN'),
      customer: {
        name: this.shippingAddress.name,
        phone: this.shippingAddress.phone,
        email: this.shippingAddress.email,
        authMethod: this.currentUser.method
      },
      shipping: this.shippingAddress,
      items: itemsSummary,
      total: total,
      payment: {
        status: 'Paid',
        gateway: 'Razorpay',
        method: this.selectedPaymentMethod.toUpperCase(),
        transactionId: `pay_${Math.random().toString(36).substring(2, 11).toUpperCase()}`
      }
    };

    // Save order
    this.orders.unshift(newOrder);
    localStorage.setItem('nile_ruhi_orders', JSON.stringify(this.orders));

    // Clear user cart state
    this.cart = [];
    this.updateCartUI();

    // Render receipt invoice and start automation logic
    this.renderReceipt(newOrder);
    this.simulateWhatsAppAutomation(newOrder);

    // Swap main views
    this.showView('success');
  }

  renderReceipt(order) {
    let itemsHtml = '';
    order.items.forEach(item => {
      itemsHtml += `
        <div class="receipt-prod-item">
          <span>${item.name} (${item.size}) x${item.qty}</span>
          <span>₹${(item.price * item.qty).toLocaleString('en-IN')}</span>
        </div>
      `;
    });

    this.dom.receiptDetails.innerHTML = `
      <div class="receipt-title">Order Receipt</div>
      <div class="receipt-row">
        <span class="label">Order ID:</span>
        <span class="val text-gold" style="font-weight:700;">${order.orderId}</span>
      </div>
      <div class="receipt-row">
        <span class="label">Transaction Ref:</span>
        <span class="val" style="font-family: monospace; font-size:12px;">${order.payment.transactionId}</span>
      </div>
      <div class="receipt-row">
        <span class="label">Customer Name:</span>
        <span class="val">${order.customer.name}</span>
      </div>
      <div class="receipt-row">
        <span class="label">Delivery Contact:</span>
        <span class="val">+91 ${order.customer.phone}</span>
      </div>
      <div class="receipt-row" style="margin-bottom: 16px;">
        <span class="label">Shipping Address:</span>
        <span class="val" style="text-align: right; max-width: 250px; font-size: 13px; color: var(--text-secondary);">
          ${order.shipping.address1}, ${order.shipping.address2 ? order.shipping.address2 + ', ' : ''}${order.shipping.city}, ${order.shipping.state} - ${order.shipping.pincode}
        </span>
      </div>
      
      <div class="receipt-products">
        ${itemsHtml}
      </div>

      <div style="height: 1px; background-color: var(--border-color-light); margin: 12px 0;"></div>
      <div class="receipt-row" style="font-weight: 700; font-size: 16px; margin-bottom: 0;">
        <span>Amount Charged (INR):</span>
        <span class="text-gold">₹${order.total.toLocaleString('en-IN')}</span>
      </div>
    `;
  }

  simulateWhatsAppAutomation(order) {
    // Generate text message for owner notification
    let itemsStr = '';
    order.items.forEach((it, idx) => {
      itemsStr += `\n   ${idx+1}. ${it.name} (${it.size}) - Qty: ${it.qty} [₹${it.price}]`;
    });

    const fullMessage = `🛍️ *NEW ORDER PLACED - NILE RUHI* 🛍️\n\n` +
      `📅 *Date:* ${order.date}\n` +
      `🆔 *Order ID:* ${order.orderId}\n\n` +
      `👤 *Customer Name:* ${order.customer.name}\n` +
      `📞 *Phone Number:* ${order.customer.phone}\n` +
      `✉️ *Email:* ${order.customer.email}\n` +
      `📍 *Shipping Address:* ${order.shipping.address1}, ${order.shipping.address2 ? order.shipping.address2 + ', ' : ''}${order.shipping.city}, ${order.shipping.state} - ${order.shipping.pincode}\n\n` +
      `📦 *Items Ordered:*${itemsStr}\n\n` +
      `💰 *Total Amount:* ₹${order.total.toLocaleString('en-IN')}\n` +
      `💳 *Payment Method:* ${order.payment.method} via ${order.payment.gateway}\n` +
      `🔖 *Transaction ID:* ${order.payment.transactionId}\n` +
      `🟢 *Status:* SUCCESS / PAID\n\n` +
      `⚡ _Sent via Nile Ruhi Automated Orders Notifier._`;

    // URI Encode for WhatsApp
    const encodedMessage = encodeURIComponent(fullMessage);
    // Setting up mock owner whatsapp phone link. 
    // You can click this to send a real message to the owner (simulated default is +919999999999 for test demo)
    const ownerNumber = '919999999999';
    const waUrl = `https://api.whatsapp.com/send?phone=${ownerNumber}&text=${encodedMessage}`;
    
    this.dom.whatsappRedirectBtn.href = waUrl;

    // Show simulated JSON API log payload
    const simulatedLogPayload = {
      event: "order.payment_received",
      timestamp: new Date().toISOString(),
      provider: "WhatsApp Cloud API Integration",
      webhook_payload: {
        to_owner_phone: `+91 ${ownerNumber.substring(2)}`,
        message_format: "Template / Text Markdown",
        data: {
          order_id: order.orderId,
          recipient_name: order.customer.name,
          recipient_phone: order.customer.phone,
          delivery_address: `${order.shipping.address1}, ${order.shipping.city}, ${order.shipping.state} - ${order.shipping.pincode}`,
          order_value_inr: order.total,
          transaction_ref: order.payment.transactionId
        }
      },
      status: "200 OK (Dispatched successfully)"
    };

    this.dom.whatsappAutomationLog.innerText = JSON.stringify(simulatedLogPayload, null, 2);
  }

  // Admin Dashboard Display
  renderAdminDashboard() {
    this.dom.adminOrdersList.innerHTML = '';
    
    if (this.orders.length === 0) {
      this.dom.adminOrdersList.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="admin-empty-state">
              <div class="admin-empty-icon"><i class="fa-solid fa-folder-open"></i></div>
              <p>No orders have been received yet.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.orders.forEach(order => {
      let itemsListHtml = '<ul class="order-items-list">';
      order.items.forEach(it => {
        itemsListHtml += `<li>• ${it.name} (${it.size}) <strong>x${it.qty}</strong></li>`;
      });
      itemsListHtml += '</ul>';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight: 700; color: var(--accent-gold); font-family: monospace;">${order.orderId}<br><span style="font-size: 10px; color: var(--text-muted); font-weight: normal; font-family: var(--font-sans);">${order.date}</span></td>
        <td>
          <strong>${order.customer.name}</strong><br>
          <span style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-phone" style="font-size:10px;"></i> +91 ${order.customer.phone}</span><br>
          <span style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-envelope" style="font-size:10px;"></i> ${order.customer.email}</span>
        </td>
        <td>
          <div class="order-address-box">
            ${order.shipping.address1}, ${order.shipping.address2 ? order.shipping.address2 + ', ' : ''}${order.shipping.city}, ${order.shipping.state} - ${order.shipping.pincode}
          </div>
        </td>
        <td>${itemsListHtml}</td>
        <td style="font-weight: 700;">₹${order.total.toLocaleString('en-IN')}</td>
        <td style="font-size:12px;">
          <strong>${order.payment.method}</strong><br>
          <span style="font-family: monospace; font-size:11px; color: var(--text-muted);">${order.payment.transactionId}</span>
        </td>
        <td><span class="status-badge paid">Paid</span></td>
      `;
      this.dom.adminOrdersList.appendChild(row);
    });
  }

  clearMockOrders() {
    if (confirm('Are you sure you want to clear the order history? This will erase local storage logs.')) {
      this.orders = [];
      localStorage.removeItem('nile_ruhi_orders');
      this.renderAdminDashboard();
      this.showToast('All order database entries cleared!');
    }
  }

  // Custom UI notification component
  showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position: fixed; bottom: 30px; left: 30px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = 'background: rgba(18, 18, 20, 0.95); border: 1px solid var(--accent-gold); color: #fff; padding: 12px 24px; border-radius: 4px; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; box-shadow: var(--shadow-lg); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; transform: translateY(20px); pointer-events: auto; display: flex; align-items: center; gap: 10px;';
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-gold"></i> ${message}`;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 50);
    
    // Auto dismiss
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Instantiate and initialize
const app = new NileRuhiApp();
document.addEventListener('DOMContentLoaded', () => app.init());

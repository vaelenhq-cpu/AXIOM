import "./style.css";
import "./styles/v1-final.css";

import {
  AppShell,
} from "./components/layout/AppShell";

import {
  registerRoute,
  renderRoute,
} from "./core/router";

import {
  LoginPage,
} from "./pages/login/login";

import {
  RegisterPage,
} from "./pages/register/register";

import {
  DashboardPage,
} from "./pages/dashboard/dashboard";

import {
  BookingsPage,
} from "./pages/bookings/bookings";

import {
  OperationsPage,
} from "./pages/operations/operations";

import {
  DriversPage,
} from "./pages/drivers/drivers";

import {
  VehiclesPage,
} from "./pages/vehicles/vehicles";

import {
  DriverLoginPage,
} from "./pages/driver/driverLogin";

import {
  DriverPanelPage,
} from "./pages/driver/driverPanel";

import {
  CustomersPage,
} from "./pages/customers/customers";

import {
  RoutesPage,
} from "./pages/routes/routes";

import {
  PricingPage,
} from "./pages/pricing/pricing";

import {
  ToursPage,
} from "./pages/tours/tours";

import {
  FinancePage,
} from "./pages/finance/finance";

import {
  IntegrationsPage,
} from "./pages/integrations/integrations";

import {
  SettingsPage,
} from "./pages/settings/settings";
import {
  CustomerBookingPage,
} from "./pages/customer/customerBooking";

import {
  BookingChannelPage,
} from "./pages/booking-channel/bookingChannel";




/* =========================================
   PUBLIC / ADMIN AUTH
========================================= */

registerRoute(
  "/login",
  LoginPage,
);

registerRoute(
  "/register",
  RegisterPage,
);

registerRoute(
  "/book",
  CustomerBookingPage,
);


/* =========================================
   DRIVER
   Admin auth'tan bağımsızdır.
========================================= */

registerRoute(
  "/driver/login",
  DriverLoginPage,
);

registerRoute(
  "/driver",
  DriverPanelPage,
);


/* =========================================
   AXIOM ADMIN
========================================= */

registerRoute(
  "/",
  () =>
    AppShell(
      DashboardPage(),
    ),
);

registerRoute(
  "/bookings",
  () =>
    AppShell(
      BookingsPage(),
    ),
);

registerRoute(
  "/operations",
  () =>
    AppShell(
      OperationsPage(),
    ),
);

registerRoute(
  "/drivers",
  () =>
    AppShell(
      DriversPage(),
    ),
);

registerRoute(
  "/vehicles",
  () =>
    AppShell(
      VehiclesPage(),
    ),
);


registerRoute(
  "/integrations",
  () =>
    AppShell(
      IntegrationsPage(),
    ),
);


registerRoute(
  "/finance",
  () =>
    AppShell(
      FinancePage(),
    ),
);


registerRoute(
  "/tours",
  () =>
    AppShell(
      ToursPage(),
    ),
);


registerRoute(
  "/pricing",
  () =>
    AppShell(
      PricingPage(),
    ),
);


registerRoute(
  "/routes",
  () =>
    AppShell(
      RoutesPage(),
    ),
);


registerRoute(
  "/customers",
  () =>
    AppShell(
      CustomersPage(),
    ),
);


/* =========================================
   SETTINGS
========================================= */

registerRoute(
  "/settings",
  () =>
    AppShell(
      SettingsPage(),
    ),
);

registerRoute(
  "/booking-channel",
  () =>
    AppShell(
      BookingChannelPage(),
    ),
);


/* =========================================
   START APPLICATION

   Bütün route'lar kaydedildikten sonra
   yalnızca bir kez çalıştırılır.
========================================= */

renderRoute();
